// Hanime1.me 适配器 — R18 番剧（Pages Functions 版）
// 搜索 + 详情 + MP4 直链获取
// 使用多策略解析，应对站点结构变化

const BASE_URL = 'https://hanime1.me';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Referer': 'https://hanime1.me/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

export interface HanimeVideo {
  video_id: string;
  title: string;
  cover_url: string;
  duration: string;
  views: string;
  rating: string;
  uploader: string;
}

export interface HanimeDetail {
  video_id: string;
  title: string;
  cover_url: string;
  description: string;
  sources: Array<{ quality: string; url: string }>;
  genre: string;
}

async function fetchHTML(url: string): Promise<{ html: string | null; status: number | null }> {
  try {
    const resp = await fetch(url, { headers: HEADERS });
    const text = await resp.text();
    return { html: text, status: resp.status };
  } catch (err: any) {
    return { html: null, status: null };
  }
}

// ========== 多策略视频卡片解析 ==========

interface ParsedCard {
  video_id: string;
  title: string;
  cover_url: string;
  duration: string;
  views: string;
  rating: string;
  uploader: string;
}

// 策略1：用 Cheerio 解析 class 类名（主流方式）
function parseWithCheerio($: cheerio.CheerioAPI): ParsedCard[] {
  const results: ParsedCard[] = [];

  // 尝试多种 container 选择器
  const containerSelectors = [
    'div.video-item-container',
    'div.video-card',
    'div.hentai-video',
    'div.video-item',
    'div.grid-item',
    'div[class*="video"]',
    'div.item',
    'li.video-item',
  ];

  for (const sel of containerSelectors) {
    const containers = $(sel);
    if (containers.length === 0) continue;
    
    containers.each((_, el) => {
      const card = parseCardContainer($, el);
      if (card && !results.some(r => r.video_id === card.video_id)) {
        results.push(card);
      }
    });

    if (results.length > 0) break; // 找到匹配的容器就停
  }

  return results;
}

function parseCardContainer($: cheerio.CheerioAPI, container: any): ParsedCard | null {
  // 找任意包含 /watch?v= 的链接
  let videoId = '';
  let link = null;

  // 先找明确带 video-link 类的
  const videoLink = $(container).find('a.video-link').first();
  if (videoLink.length > 0) {
    link = videoLink;
  } else {
    // 找任意 a[href*="/watch?v="]
    const anyLink = $(container).find('a[href*="/watch?v="]').first();
    if (anyLink.length > 0) link = anyLink;
  }

  if (!link) return null;

  const href = link.attr('href') || '';
  const match = href.match(/\/watch\?v=(\d+)/);
  if (!match) return null;
  videoId = match[1];

  // 标题 - 尝试多种选择器
  let title = '';
  const titleSelectors = [
    'div.title',
    'span.title',
    'h3',
    'h4',
    '.video-title',
    '[class*="title"]',
    'a[class*="title"]',
  ];
  for (const ts of titleSelectors) {
    const el = $(container).find(ts).first();
    if (el.length > 0) {
      title = el.text().trim();
      if (title) break;
    }
  }
  if (!title) {
    // 从 link 本身拿 title 属性
    title = link.attr('title') || '';
  }
  if (!title) {
    title = link.text().trim();
  }
  if (!title) {
    title = `Video #${videoId}`;
  }

  // 封面 - 尝试多种选择器
  let coverUrl = '';
  const coverSelectors = [
    'img.main-thumb',
    'img.thumb',
    'img[class*="thumb"]',
    'img[class*="cover"]',
    'img:first',
  ];
  for (const cs of coverSelectors) {
    const img = $(container).find(cs).first();
    if (img.length > 0) {
      coverUrl = img.attr('src') || img.attr('data-src') || '';
      if (coverUrl) break;
    }
  }

  // 时长
  let duration = '';
  const durationSelectors = [
    'div.duration',
    'span.duration',
    '[class*="duration"]',
    '.length',
  ];
  for (const ds of durationSelectors) {
    const el = $(container).find(ds).first();
    if (el.length > 0) {
      duration = el.text().trim();
      if (duration) break;
    }
  }

  // view 和 rating
  let views = '';
  let rating = '';
  $(container).find('[class*="stat"], [class*="view"], [class*="rate"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes('%') && !rating) {
      rating = text;
    } else if ((text.includes('万') || text.includes('次') || /\d/.test(text)) && !views) {
      views = text;
    }
  });

  // uploader
  let uploader = '';
  const uploaderSelectors = [
    'div.subtitle a',
    '.uploader',
    '[class*="uploader"]',
    '[class*="author"]',
    'div.meta a',
  ];
  for (const us of uploaderSelectors) {
    const el = $(container).find(us).first();
    if (el.length > 0) {
      uploader = el.text().trim();
      if (uploader) break;
    }
  }

  return {
    video_id: videoId,
    title,
    cover_url: coverUrl,
    duration,
    views,
    rating,
    uploader,
  };
}

// 策略2：用正则直接在 HTML 中找视频 ID 和相关信息
function parseWithRegex(html: string): ParsedCard[] {
  const results: ParsedCard[] = [];
  const seen = new Set<string>();

  // 找到所有 /watch?v=ID
  const watchRegex = /\/watch\?v=(\d+)/g;
  let match;
  while ((match = watchRegex.exec(html)) !== null) {
    const videoId = match[1];
    if (seen.has(videoId)) continue;
    seen.add(videoId);

    // 尝试从附近提取标题
    const pos = match.index;
    const contextBefore = html.substring(Math.max(0, pos - 500), pos);
    const contextAfter = html.substring(pos, Math.min(html.length, pos + 500));

    let title = '';
    const titleRegexes = [
      /title="([^"]*?)"/g,
      /alt="([^"]*?)"/g,
      /<img[^>]*?alt="([^"]*?)"/g,
    ];
    for (const tr of titleRegexes) {
      let m;
      tr.lastIndex = 0;
      while ((m = tr.exec(contextBefore + contextAfter)) !== null) {
        const t = m[1].trim();
        if (t && t.length > 2 && !t.startsWith('Video')) {
          title = t;
          break;
        }
      }
      if (title) break;
    }

    // 尝试从附近提取封面
    let coverUrl = '';
    const imgInContext = contextBefore + contextAfter;
    const srcMatch = imgInContext.match(/src="([^"]*?\.(?:jpg|jpeg|png|webp)[^"]*?)"/i);
    if (srcMatch) coverUrl = srcMatch[1];

    results.push({
      video_id: videoId,
      title: title || `Video #${videoId}`,
      cover_url: coverUrl,
      duration: '',
      views: '',
      rating: '',
      uploader: '',
    });
  }

  return results;
}

// ========== 统一的页面解析入口 ==========

async function parseVideoPage(url: string): Promise<ParsedCard[]> {
  const { html, status } = await fetchHTML(url);
  if (!html) return [];

  // 先尝试 cheerio 解析
  try {
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);
    const cards = parseWithCheerio($);
    if (cards.length > 0) return cards;
  } catch {
    // cheerio 解析失败，忽略
  }

  // cheerio 没找到就用正则
  return parseWithRegex(html);
}

// ========== 搜索 ==========

export async function search(keyword: string, page = 1): Promise<HanimeVideo[]> {
  return parseVideoPage(`${BASE_URL}/search?q=${encodeURIComponent(keyword)}&page=${page}`);
}

// ========== 最新 ==========
// 尝试多个 URL 以覆盖不同页面结构

const LATEST_URLS = [
  (p: number) => `${BASE_URL}/?page=${p}`,
  (p: number) => `${BASE_URL}/latest?page=${p}`,
  (p: number) => `${BASE_URL}/new?page=${p}`,
];

export async function getLatest(page = 1): Promise<HanimeVideo[]> {
  const seen = new Set<string>();
  const results: HanimeVideo[] = [];

  for (const urlFn of LATEST_URLS) {
    if (results.length > 0) break;
    const cards = await parseVideoPage(urlFn(page));
    for (const c of cards) {
      if (!seen.has(c.video_id)) {
        seen.add(c.video_id);
        results.push(c);
      }
    }
  }

  return results;
}

// ========== 按分类 ==========
// hanime1.me 的分类可能多种 URL 格式

const GENRE_URLS = [
  (g: string, p: number) => `${BASE_URL}/search?genre=${encodeURIComponent(g)}&page=${p}`,
  (g: string, p: number) => `${BASE_URL}/search?tag=${encodeURIComponent(g)}&page=${p}`,
  (g: string, p: number) => `${BASE_URL}/search?q=${encodeURIComponent(g)}&page=${p}`,
  (g: string, p: number) => `${BASE_URL}/?genre=${encodeURIComponent(g)}&page=${p}`,
];

export async function getByGenre(genre: string, page = 1): Promise<HanimeVideo[]> {
  const seen = new Set<string>();
  const results: HanimeVideo[] = [];

  for (const urlFn of GENRE_URLS) {
    if (results.length > 0) break;
    const cards = await parseVideoPage(urlFn(genre, page));
    for (const c of cards) {
      if (!seen.has(c.video_id)) {
        seen.add(c.video_id);
        results.push(c);
      }
    }
  }

  return results;
}

// ========== 视频详情（获取 MP4 直链） ==========

export async function getDetail(videoId: string): Promise<HanimeDetail | null> {
  const { html, status } = await fetchHTML(`${BASE_URL}/watch?v=${videoId}`);
  if (!html) return null;

  let $: cheerio.CheerioAPI;
  try {
    const cheerio = await import('cheerio');
    $ = cheerio.load(html);
  } catch {
    return null;
  }

  // OG 元数据
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogCover = $('meta[property="og:image"]').attr('content') || '';
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';

  const title = ogTitle.replace(/\s*-\s*Hanime1\.me$/, '').trim() || `Video #${videoId}`;

  // 视频源从 <video> <source> 标签获取
  const sources: Array<{ quality: string; url: string }> = [];

  // 找 video > source
  $('video source').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!src) return;
    const qualityMatch = src.match(/-(\d+p)\.mp4/);
    sources.push({ quality: qualityMatch ? qualityMatch[1] : 'auto', url: src });
  });

  // 也检查 video 本身的 src
  const videoSrc = $('video').attr('src');
  if (videoSrc && !sources.some(s => s.url === videoSrc)) {
    const qualityMatch = videoSrc.match(/-(\d+p)\.mp4/);
    sources.push({ quality: qualityMatch ? qualityMatch[1] : 'auto', url: videoSrc });
  }

  // 作为后备：用正则搜索 HTML 中的 MP4 链接
  if (sources.length === 0) {
    const mp4Regex = /(https?:\/\/[^"'\s]+(?:-\d+p)?\.mp4(?:\?[^"'\s]*)?)/g;
    let m;
    while ((m = mp4Regex.exec(html)) !== null) {
      const url = m[1];
      const qualityMatch = url.match(/-(\d+p)\.mp4/);
      sources.push({ quality: qualityMatch ? qualityMatch[1] : 'auto', url });
    }
  }

  // 提取分类
  let genre = '';
  const genrePatterns = ['里番', '泡面番', 'Motion Anime', '3DCG', '2.5D', '2D动画', 'AI生成', 'MMD', 'Cosplay'];
  $('a[href*="genre="]').each((_, el) => {
    const g = $(el).text().trim();
    if (g && genrePatterns.includes(g)) {
      genre = g;
    }
  });
  if (!genre) {
    // 正则捞
    for (const gp of genrePatterns) {
      if (html.includes(gp)) {
        genre = gp;
        break;
      }
    }
  }

  return {
    video_id: videoId,
    title,
    cover_url: ogCover,
    description: ogDesc,
    sources,
    genre,
  };
}
