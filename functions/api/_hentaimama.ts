// HentaiMama.io 适配器 — R18 视频（Pages Functions 版）
// 站点结构: WordPress + Dooplay 主题
//   列表: /hentai-series/ 或 /hentai-series/page/{n}/
//   搜索: /page/{n}/?s={keyword}
//   详情: /tvshows/{slug}/
//   视频源: <video><source src="xxx.mp4">
//   封面: <img data-src="xxx.png" class="lazyload">

const BASE_URL = 'https://hentaimama.io';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Referer': 'https://hentaimama.io/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

export interface HentaiVideo {
  video_id: string;
  title: string;
  cover_url: string;
  rating: string;
  year: string;
}

export interface HentaiDetail {
  video_id: string;
  title: string;
  cover_url: string;
  description: string;
  sources: Array<{ quality: string; url: string }>;
  tags: string[];
}

async function fetchHTML(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// ========== 列表 ==========
export async function getLatest(page = 1): Promise<HentaiVideo[]> {
  const url = page <= 1
    ? `${BASE_URL}/hentai-series/`
    : `${BASE_URL}/hentai-series/page/${page}/`;
  return parseListingPage(await fetchHTML(url));
}

// ========== 搜索 ==========
export async function search(keyword: string, page = 1): Promise<HentaiVideo[]> {
  const url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(keyword)}`;
  return parseListingPage(await fetchHTML(url));
}

// ========== 统一列表解析（兼容列表页 + 搜索页）==========
function parseListingPage(html: string | null): HentaiVideo[] {
  if (!html) return [];

  const results: HentaiVideo[] = [];
  const seen = new Set<string>();

  // 方法1: 匹配 <article class="item tvshows"> (列表页)
  const articleRegex1 = /<article[^>]*class="[^"]*\bitem\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let m1;
  while ((m1 = articleRegex1.exec(html)) !== null) {
    const item = parseArticle(m1[1]);
    if (item && !seen.has(item.video_id)) {
      seen.add(item.video_id);
      results.push(item);
    }
  }

  // 方法2: 匹配 <div class="result-item"> (搜索页)
  if (results.length === 0) {
    const articleRegex2 = /<div[^>]*class="[^"]*result-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    let m2;
    while ((m2 = articleRegex2.exec(html)) !== null) {
      const item = parseArticle(m2[1]);
      if (item && !seen.has(item.video_id)) {
        seen.add(item.video_id);
        results.push(item);
      }
    }
  }

  // 方法3: 全局扫 /tvshows/{slug}/
  if (results.length === 0) {
    const slugRegex = /href="[^"]*\/tvshows\/([^"\/]+)\//g;
    let m3;
    while ((m3 = slugRegex.exec(html)) !== null) {
      const slug = m3[1];
      if (seen.has(slug)) continue;
      seen.add(slug);

      const ctx = html.substring(Math.max(0, m3.index - 400), m3.index + 400);
      const titleMatch = ctx.match(/alt="([^"]{3,100})"/) || ctx.match(/title="([^"]{3,100})"/);
      const coverMatch = ctx.match(/(?:data-src|src)="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
      const ratingMatch = ctx.match(/rating[^>]*>([\d.]+)/);

      results.push({
        video_id: slug,
        title: decodeHTML(titleMatch?.[1] || slug),
        cover_url: coverMatch?.[1] || '',
        rating: ratingMatch?.[1] || '',
        year: '',
      });
    }
  }

  return results;
}

function parseArticle(articleHtml: string): HentaiVideo | null {
  const hrefMatch = articleHtml.match(/href="[^"]*\/tvshows\/([^"\/]+)\//);
  if (!hrefMatch) return null;
  const slug = hrefMatch[1];

  const altMatch = articleHtml.match(/alt="([^"]+)"/);
  const titleMatch = articleHtml.match(/title="([^"]+)"/);
  const title = altMatch?.[1] || titleMatch?.[1] || slug;

  // data-src 优先 (lazyload), 其次 src
  const coverMatch = articleHtml.match(/data-src="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
    || articleHtml.match(/src="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
  const coverUrl = coverMatch?.[1] || '';

  const ratingMatch = articleHtml.match(/rating[^>]*>([\d.]+)/);
  const yearMatch = articleHtml.match(/(\d{4})<\/span>/);

  return {
    video_id: slug,
    title: decodeHTML(title),
    cover_url: coverUrl,
    rating: ratingMatch?.[1] || '',
    year: yearMatch?.[1] || '',
  };
}

// ========== 详情 ==========
export async function getDetail(videoId: string): Promise<HentaiDetail | null> {
  const url = `${BASE_URL}/tvshows/${videoId}/`;
  const html = await fetchHTML(url);
  if (!html) return null;

  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)?.[1] || '';
  const h1Title = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, '')?.trim() || '';
  const title = decodeHTML(ogTitle || h1Title || videoId);

  const ogCover = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)?.[1] || '';
  const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)?.[1] || '';
  const desc = decodeHTML(ogDesc);

  // 视频源
  const sources: Array<{ quality: string; url: string }> = [];

  // <video> 内 <source src="xxx.mp4">
  const videoBlockRegex = /<video[^>]*>([\s\S]*?)<\/video>/gi;
  let vMatch;
  while ((vMatch = videoBlockRegex.exec(html)) !== null) {
    const srcRegex = /<source[^>]*src="([^"]+\.mp4[^"]*)"[^>]*>/gi;
    let sMatch;
    while ((sMatch = srcRegex.exec(vMatch[1])) !== null) {
      addSource(sources, sMatch[1]);
    }
  }

  // <video src="xxx.mp4">
  const videoDirect = html.match(/<video[^>]*src="([^"]+\.mp4[^"]*)"[^>]*>/i);
  if (videoDirect) addSource(sources, videoDirect[1]);

  // 全局 mp4 正则
  if (sources.length === 0) {
    const mp4Regex = /(https?:\/\/[^"'\s]+\.mp4(?:\?[^"'\s]*)?)/gi;
    let m;
    while ((m = mp4Regex.exec(html)) !== null) {
      addSource(sources, m[1]);
    }
  }

  // 标签
  const tags: string[] = [];
  const tagRegex = /<a[^>]*href="[^"]*\/genre\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let tMatch;
  while ((tMatch = tagRegex.exec(html)) !== null) {
    const tag = tMatch[1].replace(/<[^>]+>/g, '').trim();
    if (tag && tag.length < 30) tags.push(tag);
  }

  return {
    video_id: videoId,
    title: title.replace(/\s*[-–]\s*HentaiMama.*$/i, '').trim() || title,
    cover_url: ogCover,
    description: desc,
    sources,
    tags: [...new Set(tags)],
  };
}

function addSource(sources: Array<{ quality: string; url: string }>, mp4Url: string) {
  // 过滤非视频链接
  if (sources.some(s => s.url === mp4Url)) return;
  if (mp4Url.includes('pinterest') || mp4Url.includes('facebook') || mp4Url.includes('twitter')) return;
  // 优先 /uploads/ 目录的视频
  const isUpload = mp4Url.includes('/uploads/');
  const q = mp4Url.match(/[-_](\d+p)\.mp4/);
  const quality = q ? q[1] : 'auto';
  // 如果是 /uploads/ 的源，插到前面
  if (isUpload) {
    sources.unshift({ quality, url: mp4Url });
  } else {
    sources.push({ quality, url: mp4Url });
  }
}

function decodeHTML(str: string): string {
  return str
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}
