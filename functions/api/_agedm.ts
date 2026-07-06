// AGE动漫 (agedm.io) 适配器
// 对应 Python 版 source_agedm.py，用 fetch + cheerio 重写

import * as cheerio from 'cheerio';
import type { AnimeItem, AnimeDetail, EpisodeItem } from './_types';

const BASE_URL = 'https://www.agedm.io';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.agedm.io',
};

async function fetchHTML(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// 从 source_id 生成兜底封面 URL
function fallbackCover(sourceId: string): string {
  return `https://cdn.aqdstatic.com:966/age/${sourceId}.jpg`;
}

export async function search(keyword: string, page = 1): Promise<AnimeItem[]> {
  const html = await fetchHTML(`${BASE_URL}/search?query=${encodeURIComponent(keyword)}&page=${page}`);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: AnimeItem[] = [];

  $('.cata_video_item').each((_, el) => {
    const aTag = $(el).find('a[href*="/detail/"]').first();
    const href = aTag.attr('href') || '';
    const match = href.match(/\/detail\/(\d+)/);
    if (!match) return;

    const imgEl = $(el).find('img').first();
    const rawCover = imgEl.attr('data-original') || imgEl.attr('src') || '';
    const cover = (rawCover && !rawCover.includes('p1.bdxiguaimg.com') && !rawCover.includes('placeholder'))
      ? rawCover
      : fallbackCover(match[1]);

    const titleEl = $(el).find('h5 a, a[title]').first();
    const title = titleEl.attr('title') || titleEl.text().trim() || '';

    const infoMap: Record<string, string> = {};
    $(el).find('.detail_imform_tag').each((i, tagEl) => {
      const key = $(tagEl).text().trim().replace(/[：:]$/, '');
      const val = $(el).find('.detail_imform_value').eq(i).text().trim();
      if (key) infoMap[key] = val;
    });

    results.push({
      source: 'agedm',
      source_id: match[1],
      title,
      cover_url: cover,
      original_title: infoMap['原版名称'] || '',
      alt_titles: infoMap['其他名称'] || '',
      region: infoMap['地区'] || '',
      anime_type: infoMap['动画种类'] || '',
      status: infoMap['播放状态'] || '',
      year: infoMap['首播时间'] || '',
      genres: infoMap['剧情类型'] || '',
      tags: infoMap['标签'] || '',
      studio: infoMap['制作公司'] || '',
    });
  });

  return results;
}

export async function getHomepage(): Promise<AnimeItem[]> {
  const html = await fetchHTML(BASE_URL);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: AnimeItem[] = [];

  $('.video_item').each((_, el) => {
    const aTag = $(el).find('a[href*="/detail/"]').first();
    const href = aTag.attr('href') || '';
    const match = href.match(/\/detail\/(\d+)/);
    if (!match) return;

    const img = $(el).find('img').first();
    const rawCover = img.attr('data-original') || img.attr('src') || '';
    const cover = (rawCover && !rawCover.includes('p1.bdxiguaimg.com') && !rawCover.includes('placeholder'))
      ? rawCover
      : fallbackCover(match[1]);

    const titleEl = $(el).find('.video_item-title a, a[title]').first();
    const title = titleEl.attr('title') || titleEl.text().trim() || '';

    const statusText = $(el).find('.video_item--info').first().text().trim();

    results.push({
      source: 'agedm',
      source_id: match[1],
      title,
      cover_url: cover,
      status_text: statusText,
    });
  });

  return results;
}

export async function getDetail(sourceId: string): Promise<AnimeDetail | null> {
  const html = await fetchHTML(`${BASE_URL}/detail/${sourceId}`);
  if (!html) return null;

  const $ = cheerio.load(html);

  const title = $('h2.video_detail_title').first().text().trim();
  const description = $('.video_detail_desc').first().text().trim();

  const coverImg = $('.video_detail_cover img').first();
  const rawCoverUrl = coverImg.attr('data-original') || coverImg.attr('src') || '';
  const coverUrl = (rawCoverUrl && !rawCoverUrl.includes('p1.bdxiguaimg.com') && !rawCoverUrl.includes('placeholder'))
    ? rawCoverUrl
    : fallbackCover(sourceId);

  // 信息字段
  const infoMap: Record<string, string> = {};
  $('.detail_imform_tag').each((i, tagEl) => {
    const key = $(tagEl).text().trim().replace(/[：:]$/, '');
    const val = $('.detail_imform_value').eq(i).text().trim();
    if (key) infoMap[key] = val;
  });

  // 解析剧集
  const episodeMap = new Map<number, EpisodeItem>();

  $('.tab-pane').each((_, pane) => {
    const sourceName = $(pane).attr('id')?.replace('playlist-source-', '') || '默认';
    $(pane).find('a[href*="/play/"]').each((__, epEl) => {
      const epHref = $(epEl).attr('href') || '';
      const numMatch = epHref.match(/\/play\/\d+\/\d+\/(\d+)/);
      const epNum = numMatch ? parseInt(numMatch[1]) : 0;
      if (epNum === 0) return;

      if (!episodeMap.has(epNum)) {
        episodeMap.set(epNum, {
          source: 'agedm',
          episode_number: epNum,
          source_id: String(epNum),
          title: $(epEl).text().trim(),
          sources: [],
        });
      }
      episodeMap.get(epNum)!.sources!.push({
        name: sourceName,
        url: BASE_URL + epHref,
      });
    });
  });

  const episodes = Array.from(episodeMap.values()).sort((a, b) => a.episode_number - b.episode_number);

  const info: AnimeItem = {
    source: 'agedm',
    source_id: sourceId,
    title,
    original_title: infoMap['原版名称'] || '',
    alt_titles: infoMap['其他名称'] || '',
    description,
    cover_url: coverUrl,
    region: infoMap['地区'] || '',
    anime_type: infoMap['动画种类'] || '',
    status: infoMap['播放状态'] || '',
    year: infoMap['首播时间'] || '',
    genres: infoMap['剧情类型'] || '',
    tags: infoMap['标签'] || '',
    studio: infoMap['制作公司'] || '',
  };

  return { info, episodes };
}

const RANK_COVER_URL = (sourceId: string) =>
  `https://cdn.aqdstatic.com:966/age/${sourceId}.jpg`;

export async function getRanking(type: 'weekly' | 'monthly' | 'alltime'): Promise<AnimeItem[]> {
  const html = await fetchHTML(`${BASE_URL}/rank`);
  if (!html) return [];

  const $ = cheerio.load(html);

  const sectionLabels = ['周榜 TOP50', '月榜 TOP50', '总榜 TOP50'];
  const typeIndex = { weekly: 0, monthly: 1, alltime: 2 };

  let targetEl: cheerio.Cheerio | null = null;

  $('h6').each((_, el) => {
    const text = $(el).text().trim();
    if (text === sectionLabels[typeIndex[type]]) {
      targetEl = $(el);
    }
  });

  if (!targetEl) return [];

  const results: AnimeItem[] = [];

  const items = targetEl.nextAll('.rank_list_item');
  items.slice(0, 50).each((_, el) => {
    const $item = $(el);
    const rankNo = $item.find('.rank_list_item_no').text().trim();
    const titleEl = $item.find('.rank_list_item_title a');
    const href = titleEl.attr('href') || '';
    const match = href.match(/\/detail\/(\d+)/);
    if (!match) return;

    const title = titleEl.text().trim();
    const views = $item.find('.rank_list_item_views').text().trim();

    results.push({
      source: 'agedm',
      source_id: match[1],
      title,
      cover_url: RANK_COVER_URL(match[1]),
      rank: parseInt(rankNo) || 0,
      views,
    });
  });

  return results;
}

export async function getPlayUrl(playPath: string): Promise<string | null> {
  const url = playPath.startsWith('http') ? playPath : `${BASE_URL}${playPath}`;
  const html = await fetchHTML(url);
  if (!html) return null;

  const $ = cheerio.load(html);
  const iframe = $('#iframeForVideo').first();
  return iframe.attr('src') || null;
}
