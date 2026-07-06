// 樱花动漫 (yhdm) 适配器 — 917dm.com stui 模板
// 结构: 搜索 → /show/{id}.html → /v/{id}-{source}-{ep}.html → player_aaaa JSON → m3u8

import * as cheerio from 'cheerio';
import type { AnimeItem, AnimeDetail, EpisodeItem } from './types';

const DOMAINS = ['https://www.917dm.com'];  // stui 模板，kaladm/niuniudm 模板不同
let ACTIVE_DOMAIN = DOMAINS[0];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

async function tryFetch(url: string, domainIdx = 0): Promise<string | null> {
  if (domainIdx >= DOMAINS.length) return null;
  const base = DOMAINS[domainIdx];
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(fullUrl, {
      headers: { ...HEADERS, Referer: base + '/' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (resp.ok) {
      ACTIVE_DOMAIN = base;
      return await resp.text();
    }
  } catch {}
  return tryFetch(url, domainIdx + 1);
}

// ========== Homepage ==========

export async function getHomepage(): Promise<AnimeItem[]> {
  const html = await tryFetch('/');
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: AnimeItem[] = [];
  const seen = new Set<string>();

  // stui 模板有两种封面格式:
  // 1. lazyload: <a class="stui-vodlist__thumb lazyload" data-original="URL" href="/show/ID.html" title="TITLE">
  // 2. active:   <a class="stui-vodlist__thumb active" style="background: url(URL)" href="/show/ID.html" title="TITLE">
  $('a.stui-vodlist__thumb[href*="/show/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/show\/(\d+)\.html/);
    if (!match || seen.has(match[1])) return;

    const title = $(el).attr('title') || $(el).text().trim() || '';

    // 封面: data-original（懒加载）> style background-image（首屏）
    let cover = $(el).attr('data-original') || '';
    if (!cover) {
      const style = $(el).attr('style') || '';
      const bgMatch = style.match(/url\(([^)]+)\)/);
      if (bgMatch) cover = bgMatch[1].replace(/['"]/g, '');
    }

    // 兜底: 找子元素 img
    if (!cover) {
      const img = $(el).find('img').first();
      cover = img.attr('data-original') || img.attr('src') || '';
    }

    seen.add(match[1]);
    results.push({
      source: 'yhdm',
      source_id: match[1],
      title,
      cover_url: cover.startsWith('http') ? cover : (cover.startsWith('/') ? ACTIVE_DOMAIN + cover : cover),
    });
  });

  return results;
}

// ========== Search ==========

export async function search(keyword: string, page = 1): Promise<AnimeItem[]> {
  const html = await tryFetch(`/search/wd/${encodeURIComponent(keyword)}.html`);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: AnimeItem[] = [];

  // stui 模板搜索结果: 封面在 a[data-original] 或 img 上
  $('a[href*="/show/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/show\/(\d+)\.html/);
    if (!match) return;

    // 封面优先从 a 标签的 data-original 获取，其次从父元素找 img
    let cover = $(el).attr('data-original') || '';
    if (!cover) {
      const parent = $(el).closest('li, .item, [class*="item"]');
      const img = parent.find('img').first();
      cover = img.attr('data-original') || img.attr('data-src') || img.attr('src') || '';
    }
    const title = $(el).attr('title') || $(el).text().trim() || '';
    const statusText = $(el).find('.pic-text').text().trim() || $(el).closest('li').find('.pic-text').text().trim();

    // 去重
    if (results.find(r => r.source_id === match[1])) return;

    results.push({
      source: 'yhdm',
      source_id: match[1],
      title,
      cover_url: cover.startsWith('http') ? cover : (cover.startsWith('//') ? 'https:' + cover : (cover.startsWith('/') ? ACTIVE_DOMAIN + cover : cover)),
      status_text: statusText,
    });
  });

  return results;
}

// ========== Detail + Episodes ==========

export async function getDetail(sourceId: string): Promise<AnimeDetail | null> {
  const html = await tryFetch(`/show/${sourceId}.html`);
  if (!html) return null;

  const $ = cheerio.load(html);

  // 标题 — stui模板: 《title》动漫全集在线观看完整版 - 樱花动漫
  const rawTitle = $('title').first().text().trim();
  const titleMatch = rawTitle.match(/《([^》]+)》/);
  const title = titleMatch ? titleMatch[1] : rawTitle.replace(/动漫全集.*$/, '').trim()
    || $('h1, h2, .stui-content__detail .title').first().text().trim()
    || sourceId;

  // 描述
  const description = $('meta[name="description"]').attr('content') || '';

  // 封面
  const coverImg = $('.stui-content__thumb img, img[src*="' + sourceId + '"], .detail-pic img').first();
  const coverUrl = coverImg.attr('data-original') || coverImg.attr('src') || '';

  // 信息字段
  const infoMap: Record<string, string> = {};
  $('.stui-content__detail .data .item, .detail-info li, [class*="info"] li').each((_, el) => {
    const text = $(el).text().trim();
    const parts = text.split(/[：:]/);
    if (parts.length >= 2) {
      infoMap[parts[0].trim()] = parts.slice(1).join(':').trim();
    }
  });

  // 剧集 — stui 模板播放列表
  const episodes: EpisodeItem[] = [];
  const seenEps = new Set<number>();

  $('ul[class*="playlist"], ul.stui-content__playlist').each((_, ul) => {
    $(ul).find('li a').each((__, a) => {
      const href = $(a).attr('href') || '';
      const epMatch = href.match(/\/v\/(\d+)-(\d+)-(\d+)\.html/);
      if (!epMatch) return;

      const sourceIdx = parseInt(epMatch[2]);
      const epNum = parseInt(epMatch[3]);
      const epTitle = $(a).text().trim() || `第${epNum}集`;
      const sourceName = $(ul).closest('.tab-pane').find('.title, h4').text().trim()
        || `源${sourceIdx}`;

      if (!seenEps.has(epNum)) {
        seenEps.add(epNum);
        episodes.push({
          source: 'yhdm',
          episode_number: epNum,
          source_id: String(epNum),
          title: epTitle,
          sources: [{ name: sourceName, url: ACTIVE_DOMAIN + href }],
        });
      } else {
        const existing = episodes.find(e => e.episode_number === epNum);
        if (existing?.sources) {
          existing.sources.push({ name: sourceName, url: ACTIVE_DOMAIN + href });
        }
      }
    });
  });

  const info: AnimeItem = {
    source: 'yhdm',
    source_id: sourceId,
    title,
    description,
    cover_url: coverUrl.startsWith('http') ? coverUrl : (coverUrl.startsWith('//') ? 'https:' + coverUrl : (coverUrl.startsWith('/') ? ACTIVE_DOMAIN + coverUrl : coverUrl)),
    genres: infoMap['类型'] || infoMap['分类'] || '',
    status: infoMap['状态'] || infoMap['更新'] || '',
    year: infoMap['年份'] || infoMap['年代'] || '',
    region: infoMap['地区'] || '',
    anime_type: infoMap['类型'] || '',
    original_title: infoMap['原名'] || '',
    alt_titles: infoMap['别名'] || '',
  };

  return { info, episodes: episodes.sort((a, b) => a.episode_number - b.episode_number) };
}

// ========== 获取视频播放地址 ==========

function extractVideoUrl(html: string): string | null {
  // stui 模板: player_aaaa 配置中包含 m3u8 URL
  const playerMatch = html.match(/var\s+player_\w+\s*=\s*(\{[^;]+\})/);
  if (playerMatch) {
    try {
      const config = JSON.parse(playerMatch[1]);
      if (config.url) return config.url.replace(/\\\//g, '/');
    } catch {}
  }

  // 直接匹配 m3u8/mp4
  const m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
  if (m3u8Match) return m3u8Match[0];

  const mp4Match = html.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/i);
  if (mp4Match) return mp4Match[0];

  return null;
}

export async function getPlayUrl(episodePath: string): Promise<string | null> {
  const html = await tryFetch(episodePath);
  if (!html) return null;

  return extractVideoUrl(html);
}
