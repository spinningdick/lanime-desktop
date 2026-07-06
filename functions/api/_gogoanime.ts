// GogoAnime 适配器

import * as cheerio from 'cheerio';
import type { AnimeItem, AnimeDetail, EpisodeItem } from './_types';

const GOGO_DOMAINS = [
  'https://gogoanime3.co',
  'https://gogoanime.hu',
  'https://gogoanime.biz',
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.5',
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

function extractSlug(href: string): string | null {
  const m = href.match(/\/category\/(.+)/);
  return m ? m[1] : null;
}

function extractEpNum(href: string): number {
  const m = href.match(/episode[- ]?(\d+)/i);
  return m ? parseInt(m[1]) : 0;
}

export async function search(keyword: string, page = 1): Promise<AnimeItem[]> {
  const url = `${GOGO_DOMAINS[0]}/search.html?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  const html = await fetchHTML(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: AnimeItem[] = [];

  $('.last_episode .items li, ul.items li').each((_, el) => {
    const aTag = $(el).find('a[href*="/category/"]').first();
    const href = aTag.attr('href') || '';
    const slug = extractSlug(href);
    if (!slug) return;

    const title = aTag.attr('title') || aTag.text().trim();
    const cover = $(el).find('img').first().attr('src') || '';

    results.push({
      source: 'gogoanime',
      source_id: slug,
      title,
      cover_url: cover,
    });
  });

  return results;
}

export async function getHomepage(): Promise<AnimeItem[]> {
  const html = await fetchHTML(GOGO_DOMAINS[0]);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: AnimeItem[] = [];

  $('ul.items li').each((_, el) => {
    const aTag = $(el).find('a[href*="/category/"]').first();
    const href = aTag.attr('href') || '';
    const slug = extractSlug(href);
    if (!slug) return;

    const title = aTag.attr('title') || aTag.text().trim();
    const cover = $(el).find('img').first().attr('src') || '';
    const statusText = $(el).find('.episode, p.episode').first().text().trim();

    results.push({
      source: 'gogoanime',
      source_id: slug,
      title,
      cover_url: cover,
      status_text: statusText,
    });
  });

  return results;
}

export async function getDetail(sourceId: string): Promise<AnimeDetail | null> {
  const html = await fetchHTML(`${GOGO_DOMAINS[0]}/category/${sourceId}`);
  if (!html) return null;

  const $ = cheerio.load(html);

  const title = $('h2.anime_info_body_bg h1, div.anime_info_body_bg h1').first().text().trim() || sourceId;
  const description = $('p.description, .description').first().text().trim();
  const coverUrl = $('div.anime_info_body_bg img').first().attr('src') || '';

  const infoMap: Record<string, string> = {};
  $('div.anime_info_body_bg p[class^="type"]').each((_, pEl) => {
    const text = $(pEl).text().trim();
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0) {
      infoMap[text.slice(0, colonIdx).trim()] = text.slice(colonIdx + 1).trim();
    }
  });

  const episodes: EpisodeItem[] = [];
  $('#episode_page a, ul#episode_related li a').each((_, epEl) => {
    const epHref = $(epEl).attr('href') || '';
    const epNum = extractEpNum(epHref);
    if (epNum === 0) return;

    const epTitle = $(epEl).attr('ep_start') || $(epEl).text().trim() || `EP ${epNum}`;
    const fullUrl = epHref.startsWith('http') ? epHref : `${GOGO_DOMAINS[0]}/${sourceId}-episode-${epNum}`;

    episodes.push({
      source: 'gogoanime',
      episode_number: epNum,
      source_id: String(epNum),
      title: epTitle,
      sources: [{ name: 'GogoAnime', url: fullUrl }],
    });
  });

  const info: AnimeItem = {
    source: 'gogoanime',
    source_id: sourceId,
    title,
    description,
    cover_url: coverUrl,
    genres: infoMap['Genre'] || infoMap['类型'] || '',
    status: infoMap['Status'] || '',
    year: infoMap['Released'] || infoMap['年份'] || '',
    studio: infoMap['Produced by'] || infoMap['制作'] || '',
    rating: parseFloat(infoMap['Score'] || '0') || 0,
  };

  return {
    info,
    episodes: episodes.sort((a, b) => a.episode_number - b.episode_number),
  };
}

export async function getPlayUrl(playPath: string): Promise<string | null> {
  const url = playPath.startsWith('http') ? playPath : `${GOGO_DOMAINS[0]}/${playPath}`;
  const html = await fetchHTML(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  const iframe = $('#gogo-player iframe, iframe[src*="gogo"]').first();
  if (iframe.attr('src')) return iframe.attr('src')!;

  const videoEl = $('[data-video]').first();
  if (videoEl.attr('data-video')) return videoEl.attr('data-video')!;

  const player = $('#playercontainer, .play-video').first();
  for (const attr of ['data-video', 'src', 'data-src']) {
    const val = player.attr(attr);
    if (val) return val;
  }

  return null;
}
