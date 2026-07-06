// 风车动漫 (fengchedm) 适配器 — conch 模板
// 结构: 搜索 → /vodsearch/{keyword}-------------.html → /you-{id}.html → /mei-{id}-{source}-{ep}.html → player JSON → m3u8

import * as cheerio from 'cheerio';
import type { AnimeItem, AnimeDetail, EpisodeItem } from './types';

const DOMAINS = ['https://www.fengchedm1.com', 'https://www.fengchedongman8.net'];
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

  // conch 模板首页: <a class="hl-item-thumb hl-lazy" href="/you-ID.html" data-original="URL" title="TITLE">
  $('a[href*="/you-"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/you-(\d+)\.html/);
    if (!match || seen.has(match[1])) return;

    const title = $(el).attr('title') || $(el).text().trim() || '';

    // 封面: data-original（on a tag itself）> 子 img 的 data-original/src
    let cover = $(el).attr('data-original') || '';
    if (!cover) {
      const parent = $(el).closest('li, .hl-item, [class*="item"]');
      const img = parent.find('img').first();
      cover = img.attr('data-original') || img.attr('src') || '';
    }

    seen.add(match[1]);
    results.push({
      source: 'fengchedm',
      source_id: match[1],
      title,
      cover_url: cover.startsWith('http') ? cover : (cover.startsWith('/') ? ACTIVE_DOMAIN + cover : cover),
    });
  });

  return results;
}

// ========== Search ==========

export async function search(keyword: string, page = 1): Promise<AnimeItem[]> {
  const html = await tryFetch(`/vodsearch/${encodeURIComponent(keyword)}-------------.html`);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: AnimeItem[] = [];
  const seen = new Set<string>();

  // conch 模板搜索结果: a[title] 包含 /you-{id}.html
  $('a[href*="/you-"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/you-(\d+)\.html/);
    if (!match) return;

    const sid = match[1];
    if (seen.has(sid)) return;
    seen.add(sid);

    const title = $(el).attr('title') || $(el).text().trim() || '';
    // 封面优先从 a 标签的 data-original 获取（conch 模板）
    let cover = $(el).attr('data-original') || '';
    if (!cover) {
      const parent = $(el).closest('li, .hl-item, [class*="item"]');
      const img = parent.find('img').first();
      cover = img.attr('data-original') || img.attr('src') || '';
    }
    const statusText = $(el).find('.hl-pic-text, .remarks').text().trim()
      || $(el).closest('li').find('.hl-pic-text, .remarks').text().trim();

    results.push({
      source: 'fengchedm',
      source_id: sid,
      title,
      cover_url: cover.startsWith('http') ? cover : (cover.startsWith('//') ? 'https:' + cover : (cover.startsWith('/') ? ACTIVE_DOMAIN + cover : cover)),
      status_text: statusText,
    });
  });

  // 如果没有搜到，尝试搜索/you- 链接附近的标题文本
  if (results.length === 0) {
    $('a[title]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const youMatch = href.match(/\/you-(\d+)\.html/);
      if (!youMatch) return;

      const sid = youMatch[1];
      if (seen.has(sid)) return;
      seen.add(sid);

      const cover = $(el).attr('data-original') || '';

      results.push({
        source: 'fengchedm',
        source_id: sid,
        title: $(el).attr('title') || '',
        cover_url: cover.startsWith('http') ? cover : '',
      });
    });
  }

  return results;
}

// ========== Detail + Episodes ==========

export async function getDetail(sourceId: string): Promise<AnimeDetail | null> {
  const html = await tryFetch(`/you-${sourceId}.html`);
  if (!html) return null;

  const $ = cheerio.load(html);

  // 标题 — 从 <title> 提取
  const titleText = $('title').first().text().trim();
  const title = titleText.replace(/[《》].*$/, '').replace(/《/, '').replace(/》/, '').trim()
    || $('h1, h2, .title').first().text().trim()
    || sourceId;

  // 描述
  const description = $('meta[name="description"]').attr('content') || '';

  // 封面
  const coverImg = $('.hl-detail-pic img, .detail-pic img, img[src*="' + sourceId + '"]').first();
  const coverUrl = coverImg.attr('data-original') || coverImg.attr('src') || '';

  // 信息字段
  const infoMap: Record<string, string> = {};
  $('.hl-detail-content .data .item, .detail-info li, [class*="info"] li').each((_, el) => {
    const text = $(el).text().trim();
    const parts = text.split(/[：:]/);
    if (parts.length >= 2) {
      infoMap[parts[0].trim()] = parts.slice(1).join(':').trim();
    }
  });

  // 剧集 — conch 模板: /mei-{id}-{source}-{ep}.html
  const episodes: EpisodeItem[] = [];
  const seenEps = new Set<number>();

  // 找所有 mei 链接（剧集播放链接）
  $('a[href*="/mei-"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const epMatch = href.match(/\/mei-\d+-(\d+)-(\d+)\.html/);
    if (!epMatch) return;

    const sourceIdx = parseInt(epMatch[1]);
    const epNum = parseInt(epMatch[2]);
    const epTitle = $(a).text().trim() || `第${epNum}集`;

    if (!seenEps.has(epNum)) {
      seenEps.add(epNum);
      episodes.push({
        source: 'fengchedm',
        episode_number: epNum,
        source_id: String(epNum),
        title: epTitle,
        sources: [{ name: `源${sourceIdx}`, url: ACTIVE_DOMAIN + href }],
      });
    } else {
      const existing = episodes.find(e => e.episode_number === epNum);
      if (existing?.sources) {
        existing.sources.push({ name: `源${sourceIdx}`, url: ACTIVE_DOMAIN + href });
      }
    }
  });

  const info: AnimeItem = {
    source: 'fengchedm',
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
  // conch 模板: player_xxx 配置中包含 m3u8 URL
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

  // iframe 中的链接
  const iframeMatch = html.match(/<iframe[^>]*src=["']([^"']+)["']/i);
  if (iframeMatch) {
    const src = iframeMatch[1];
    if (src.includes('m3u8') || src.includes('mp4')) return src;
  }

  return null;
}

export async function getPlayUrl(episodePath: string): Promise<string | null> {
  const html = await tryFetch(episodePath);
  if (!html) return null;

  return extractVideoUrl(html);
}
