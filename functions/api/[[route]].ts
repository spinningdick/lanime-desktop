// Pages Functions 主路由 — 替代独立 Worker
// 处理所有 /api/* 和 /cover/* 请求

import * as agedm from './_agedm';
import * as yhdm from './_yhdm';
import * as fengchedm from './_fengchedm';
import * as gogoanime from './_gogoanime';
import * as hanime from './_hanime';
import * as db from './_db';
import type { Env } from './_types';

interface PagesContext {
  request: Request;
  env: Env;
  params: Record<string, string>;
  data: Record<string, any>;
  waitUntil: (promise: Promise<unknown>) => void;
}

// ==================== 工具函数 ====================

function fallbackCover(sourceId: string): string {
  return `https://cdn.aqdstatic.com:966/age/${sourceId}.jpg`;
}

function normalizeCoverUrl(url: string, source: string, sourceId?: string): string {
  if (!url) return '';
  if (url.includes('p1.bdxiguaimg.com') || url.includes('placeholder') || url.includes('noimage')) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return `https://www.agedm.io${url}`;
  return url;
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function html(data: string, status = 200): Response {
  return new Response(data, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ==================== Auth 工具 ====================

const JWT_SECRET = 'lanime-secret-key-2026';

function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function uint8ToB64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder().encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc, { name: 'PBKDF2' }, false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return uint8ToB64(salt) + ':' + uint8ToB64(new Uint8Array(hash));
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':');
  const salt = b64ToUint8(saltB64);
  const enc = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey('raw', enc, { name: 'PBKDF2' }, false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return uint8ToB64(new Uint8Array(hash)) === hashB64;
}

async function signJWT(payload: any): Promise<string> {
  const header = uint8ToB64(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = uint8ToB64(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(header + '.' + body));
  return header + '.' + body + '.' + uint8ToB64(new Uint8Array(sig));
}

async function verifyJWT(token: string): Promise<any> {
  try {
    const parts = token.replace('Bearer ', '').split('.');
    if (parts.length !== 3) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('HMAC', key,
      b64ToUint8(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!valid) return null;
    return JSON.parse(new TextDecoder().decode(b64ToUint8(parts[1])));
  } catch { return null; }
}

// ==================== 路由分发 ====================

export async function onRequest(context: PagesContext) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // OPTIONS 预检
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // ==================== /api/auth/register ====================
  if (path === '/api/auth/register' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { email, password, nickname } = body;
    if (!email || !password) return json({ error: '邮箱和密码不能为空' }, 400);
    if (password.length < 6) return json({ error: '密码至少6位' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: '邮箱格式不正确' }, 400);

    // 检查重复
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
    if (existing) return json({ error: '该邮箱已注册' }, 409);

    const passwordHash = await hashPassword(password);
    const nick = nickname || email.split('@')[0];

    const result = await env.DB.prepare(
      'INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)'
    ).bind(email.toLowerCase(), passwordHash, nick).run();

    const userId = result.meta?.last_row_id || 0;
    const token = await signJWT({ id: userId, email: email.toLowerCase() });

    return json({
      token,
      user: { id: userId, email: email.toLowerCase(), nickname: nick },
    }, 201);
  }

  // ==================== /api/auth/login ====================
  if (path === '/api/auth/login' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;
    if (!email || !password) return json({ error: '邮箱和密码不能为空' }, 400);

    const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email.toLowerCase()).first<any>();

    if (!row) return json({ error: '账号不存在' }, 401);

    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) return json({ error: '密码错误' }, 401);

    const token = await signJWT({ id: row.id, email: row.email });

    return json({
      token,
      user: { id: row.id, email: row.email, nickname: row.nickname || '' },
    });
  }

  // ==================== /api/auth/me ====================
  if (path === '/api/auth/me' && method === 'GET') {
    const auth = request.headers.get('Authorization') || '';
    const payload = await verifyJWT(auth);
    if (!payload) return json({ error: '未登录' }, 401);

    const row = await env.DB.prepare('SELECT id, email, nickname, avatar FROM users WHERE id = ?')
      .bind(payload.id).first<any>();
    if (!row) return json({ error: '用户不存在' }, 404);

    return json({ id: row.id, email: row.email, nickname: row.nickname || '', avatar: row.avatar || '' });
  }

  // ==================== /api/auth/avatar ====================
  if (path === '/api/auth/avatar' && method === 'PATCH') {
    const auth = request.headers.get('Authorization') || '';
    const payload = await verifyJWT(auth);
    if (!payload) return json({ error: '未登录' }, 401);

    const body = await request.json().catch(() => ({}));
    const avatar = body.avatar || '';
    // 前端已压缩，这里只做兜底限制（data URL 不超过 500KB）
    if (avatar && avatar.length > 700000) return json({ error: '图片太大' }, 400);

    await env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?')
      .bind(avatar, payload.id).run();

    return json({ avatar });
  }

  // ==================== /api/tags ====================
  if (path === '/api/tags' && method === 'GET') {
    const { results } = await env.DB.prepare(
      "SELECT genres, tags FROM anime WHERE genres != '' OR tags != '' LIMIT 2000"
    ).all<any>().catch(() => ({ results: [] }));

    const tagSet = new Set<string>();
    for (const row of (results || [])) {
      // genres 和 tags 可能是逗号分隔或 JSON 数组
      for (const field of [row.genres, row.tags]) {
        if (!field) continue;
        // 尝试 JSON 解析，失败则按逗号分隔
        let items: string[] = [];
        try {
          const parsed = JSON.parse(field);
          items = Array.isArray(parsed) ? parsed : [];
        } catch {
          // 逗号或空格分隔
          items = field.split(/[,\s]+/).map((s: string) => s.trim()).filter(Boolean);
        }
        for (const t of items) {
          const tag = t.trim();
          if (!tag || tag.length >= 30) continue;
          // 英文/纯ASCII标签统一为"其他"
          if (/^[\x00-\x7F]+$/.test(tag)) {
            tagSet.add('其他');
          } else {
            tagSet.add(tag);
          }
        }
      }
    }

    const sorted = [...tagSet].sort((a, b) => a.localeCompare(b, 'zh'));

    // 后台用热门标签搜索源站，补全缺失的动漫和标签数据
    context.waitUntil((async () => {
      const topTags = sorted.slice(0, 8); // 拿前 8 个标签去搜
      for (const tag of topTags) {
        try {
          const srcResults = await Promise.all([
            agedm.search(tag).catch(() => [] as any[]),
            yhdm.search(tag).catch(() => [] as any[]),
            fengchedm.search(tag).catch(() => [] as any[]),
          ]);
          for (const src of srcResults) {
            for (const item of (src || [])) {
              if (!item.source_id || !item.title) continue;
              try {
                const col = item.source === 'agedm' ? 'age_id'
                  : item.source === 'yhdm' ? 'yhdm_id'
                  : item.source === 'fengchedm' ? 'yhdm_id' : null;
                if (!col) continue;
                const exists = await env.DB.prepare(`SELECT id FROM anime WHERE ${col} = ?`)
                  .bind(item.source_id).first();
                if (!exists) {
                  await env.DB.prepare(
                    `INSERT INTO anime (source, ${col}, title, cover_url, status, genres, tags, year, region, anime_type)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                  ).bind(
                    item.source, item.source_id, item.title,
                    item.source === 'agedm' ? fallbackCover(item.source_id) : (item.cover_url || ''),
                    item.status || '', item.genres || '', item.tags || '',
                    item.year || '', item.region || '', item.anime_type || ''
                  ).run();
                } else if (item.genres || item.tags) {
                  // 已有记录但缺标签数据，补上
                  await env.DB.prepare(
                    `UPDATE anime SET genres = CASE WHEN genres = '' OR genres IS NULL THEN ? ELSE genres END,
                     tags = CASE WHEN tags = '' OR tags IS NULL THEN ? ELSE tags END WHERE ${col} = ?`
                  ).bind(item.genres || '', item.tags || '', item.source_id).run();
                }
              } catch { /* skip dup */ }
            }
          }
        } catch { /* 单个标签失败不影响其他 */ }
      }
    })());

    return json(sorted);
  }

  // ==================== /api/anime/by-tags ====================
  if (path === '/api/anime/by-tags' && method === 'GET') {
    const tagsParam = url.searchParams.get('tags') || '';
    const tags = tagsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (!tags.length) return json({ items: [], hasMore: false });

    // 1. 查本地 DB（有标签元数据）
    const conditions = tags.map(() => '(genres LIKE ? OR tags LIKE ?)');
    const sql = `SELECT * FROM anime WHERE ${conditions.join(' AND ')} LIMIT 200`;
    const dbParams: any[] = [];
    for (const tag of tags) {
      dbParams.push(`%${tag}%`, `%${tag}%`);
    }
    const { results: dbResults } = await env.DB.prepare(sql).bind(...dbParams).all<any>().catch(() => ({ results: [] }));

    const dbItems = (dbResults || []).map((row: any) => ({
      id: row.id,
      source: row.source,
      age_id: row.age_id,
      yhdm_id: row.yhdm_id,
      title: row.title,
      cover_url: row.cover_url || (row.age_id ? fallbackCover(row.age_id) : ''),
      status_text: row.status || '',
    }));

    // 2. 只有单标签时才用源站搜索补充（多标签无法保证 AND 逻辑）
    let sourceItems: any[] = [];
    if (tags.length === 1 && dbItems.length < 30) {
      const keyword = tags[0];
      const srcResults = await Promise.all([
        agedm.search(keyword).catch(() => [] as any[]),
        yhdm.search(keyword).catch(() => [] as any[]),
        fengchedm.search(keyword).catch(() => [] as any[]),
      ]);
      const dbTitles = new Set(dbItems.map((i: any) => i.title));
      for (const src of srcResults) {
        for (const item of (src || [])) {
          if (!dbTitles.has(item.title)) {
            dbTitles.add(item.title);
            sourceItems.push({
              ...item,
              cover_url: item.source === 'agedm' ? fallbackCover(item.source_id) : (item.cover_url || ''),
            });
          }
        }
      }
    }

    const items = [...dbItems, ...sourceItems.slice(0, 100)];
    return json({ items, hasMore: false, total: items.length });
  }

  // ==================== /api/sources ====================
  if (path === '/api/sources') {
    return json([
      { id: 'agedm', name: 'AGE动漫 (中字)' },
      { id: 'yhdm', name: '樱花动漫 (中字)' },
      { id: 'fengchedm', name: '风车动漫 (中字)' },
      { id: 'jikan', name: 'MyAnimeList (元数据)' },
    ]);
  }

  // ==================== /api/anime/home ====================
  if (path === '/api/anime/home') {
    const [agedmItems, yhdmItems, fcmItems] = await Promise.all([
      agedm.getHomepage().catch(() => [] as any[]),
      yhdm.getHomepage().catch(() => [] as any[]),
      fengchedm.getHomepage().catch(() => [] as any[]),
    ]);
    const items = [...agedmItems, ...yhdmItems, ...fcmItems];

    // 后台批量 upsert 到数据库，积累标签数据
    context.waitUntil((async () => {
      for (const item of items) {
        try {
          if (item.source === 'agedm' && item.source_id) {
            const exists = await env.DB.prepare('SELECT id FROM anime WHERE age_id = ?').bind(item.source_id).first();
            if (!exists) {
              await env.DB.prepare(
                'INSERT INTO anime (source, age_id, title, cover_url, status) VALUES (?, ?, ?, ?, ?)'
              ).bind(item.source, item.source_id, item.title, fallbackCover(item.source_id), item.status_text || '').run();
            }
          } else if (item.source_id && item.title) {
            const col = item.source === 'yhdm' ? 'yhdm_id' : (item.source === 'fengchedm' ? 'yhdm_id' : null);
            if (col) {
              const exists = await env.DB.prepare(`SELECT id FROM anime WHERE ${col} = ?`).bind(item.source_id).first();
              if (!exists) {
                await env.DB.prepare(
                  `INSERT INTO anime (source, ${col}, title, cover_url, status) VALUES (?, ?, ?, ?, ?)`
                ).bind(item.source, item.source_id, item.title, item.cover_url || '', item.status_text || '').run();
              }
            }
          }
        } catch { /* skip duplicate */ }
      }
    })());

    return json(items.map((item: any) => ({
      ...item,
      cover_url: item.source === 'agedm' ? fallbackCover(item.source_id) : (item.cover_url || ''),
    })));
  }

  // ==================== /api/anime/ranking ====================
  if (path === '/api/anime/ranking') {
    const type = url.searchParams.get('type') || 'weekly';
    if (!['weekly', 'monthly', 'alltime'].includes(type)) {
      return json({ error: '无效排行类型，可选: weekly, monthly, alltime' }, 400);
    }

    const items = await agedm.getRanking(type as 'weekly' | 'monthly' | 'alltime')
      .catch(() => [] as any[]);

    const labelMap: Record<string, string> = {
      weekly: '周榜 TOP50',
      monthly: '月榜 TOP50',
      alltime: '总榜 TOP50',
    };

    return json({
      type,
      label: labelMap[type],
      updated_at: new Date().toISOString(),
      items: items.map((item: any) => ({
        ...item,
        cover_url: `https://cdn.aqdstatic.com:966/age/${item.source_id}.jpg`,
      })),
    });
  }

  // ==================== /api/anime/search ====================
  if (path === '/api/anime/search') {
    const keyword = url.searchParams.get('keyword') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    if (!keyword) return json({ total: 0, items: [] });

    const SEARCH_TIMEOUT = 8000;
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);
    };

    const [localResults, agedmItems] = await Promise.all([
      db.searchLocalAnime(env.DB, keyword).catch(() => []),
      withTimeout(agedm.search(keyword, page).catch(() => [] as any[]), SEARCH_TIMEOUT),
    ]);

    const fixCover = (item: any) => ({
      ...item,
      cover_url: normalizeCoverUrl(item.cover_url || '', item.source, item.source_id) || fallbackCover(item.source_id),
    });

    const agedmFixed = agedmItems.map(fixCover);

    const seenIds = new Set<string>();
    const merged: any[] = [];

    for (const item of agedmFixed) {
      const key = `${item.source}:${item.source_id}`;
      if (!seenIds.has(key)) {
        merged.push({ id: 0, ...item, age_id: item.source_id });
        seenIds.add(key);
      }
    }

    for (const item of localResults) {
      const key = `${item.source}:${(item as any).age_id || item.id}`;
      if (!seenIds.has(key)) {
        const cover = item.cover_url || (item.age_id ? fallbackCover(item.age_id) : '');
        merged.push({ ...item, cover_url: cover });
        seenIds.add(key);
      }
    }

    return json({ total: merged.length, items: merged.slice(0, 50) });
  }

  // ==================== /api/anime/yhdm/search ====================
  if (path === '/api/anime/yhdm/search') {
    const keyword = url.searchParams.get('keyword') || '';
    if (!keyword) return json({ items: [] });
    const items = await yhdm.search(keyword).catch(() => [] as any[]);
    return json({ items });
  }

  // ==================== /api/anime/fcm/search ====================
  if (path === '/api/anime/fcm/search') {
    const keyword = url.searchParams.get('keyword') || '';
    if (!keyword) return json({ items: [] });
    const items = await fengchedm.search(keyword).catch(() => [] as any[]);
    return json({ items });
  }

  // ==================== /api/anime/yhdm/:yhdmId ====================
  const yhdmMatch = path.match(/^\/api\/anime\/yhdm\/(\d+)$/);
  if (yhdmMatch) {
    const yhdmId = yhdmMatch[1];
    const detail = await yhdm.getDetail(yhdmId).catch(() => null);
    if (!detail) return json({ error: '未找到该动漫' }, 404);
    return json({
      id: 0,
      yhdm_id: yhdmId,
      source: 'yhdm',
      ...detail.info,
      episodes: detail.episodes,
    });
  }

  // ==================== /api/anime/fcm/:fcmId ====================
  const fcmMatch = path.match(/^\/api\/anime\/fcm\/(\d+)$/);
  if (fcmMatch) {
    const fcmId = fcmMatch[1];
    const detail = await fengchedm.getDetail(fcmId).catch(() => null);
    if (!detail) return json({ error: '未找到该动漫' }, 404);
    return json({
      id: 0,
      fcm_id: fcmId,
      source: 'fengchedm',
      ...detail.info,
      episodes: detail.episodes,
    });
  }

  // ==================== /api/play/yhdm/* ====================
  if (path.startsWith('/api/play/yhdm/')) {
    const playPath = path.replace('/api/play/yhdm', '');
    if (!playPath) return json({ error: '缺少播放路径' }, 400);
    try {
      const videoUrl = await yhdm.getPlayUrl(playPath);
      if (!videoUrl) return json({ error: '获取播放链接失败' }, 404);
      return json({ url: videoUrl, type: videoUrl.includes('m3u8') ? 'hls' : 'direct' });
    } catch {
      return json({ error: '获取播放链接异常' }, 502);
    }
  }

  // ==================== /api/play/fcm/* ====================
  if (path.startsWith('/api/play/fcm/')) {
    const playPath = path.replace('/api/play/fcm', '');
    if (!playPath) return json({ error: '缺少播放路径' }, 400);
    try {
      const videoUrl = await fengchedm.getPlayUrl(playPath);
      if (!videoUrl) return json({ error: '获取播放链接失败' }, 404);
      return json({ url: videoUrl, type: videoUrl.includes('m3u8') ? 'hls' : 'direct' });
    } catch {
      return json({ error: '获取播放链接异常' }, 502);
    }
  }

  // ==================== /api/anime/age/:ageId ====================
  const ageMatch = path.match(/^\/api\/anime\/age\/(\d+)$/);
  if (ageMatch) {
    const ageId = ageMatch[1];
    let anime = await db.findAnimeByAgeId(env.DB, ageId).catch(() => null);

    if (anime) {
      const episodes = await db.getEpisodesByAnimeId(env.DB, anime.id).catch(() => []);

      // 后台异步刷新剧集（有新集就更新，无感知）
      context.waitUntil((async () => {
        try {
          const fresh = await agedm.getDetail(ageId);
          if (fresh && fresh.episodes.length > episodes.length) {
            await db.replaceEpisodes(env.DB, anime!.id, fresh.episodes);
          }
          // 同时更新封面等信息
          if (fresh && fresh.info.cover_url && fresh.info.cover_url !== anime!.cover_url) {
            await env.DB.prepare('UPDATE anime SET cover_url = ?, updated_at = datetime(\'now\') WHERE id = ?')
              .bind(normalizeCoverUrl(fresh.info.cover_url, 'agedm', ageId) || fallbackCover(ageId), anime!.id)
              .run();
          }
        } catch { /* 静默失败 */ }
      })());

      if (anime.description || episodes.length > 0) {
        return json({ ...animeRowToResponse(anime), episodes: episodes.map(episodeToResponse) });
      }
    }

    const detail = await agedm.getDetail(ageId).catch(() => null);
    if (!detail) return json({ error: '未找到该动漫' }, 404);

    const animeId = await db.upsertAnime(env.DB, {
      source: 'agedm',
      age_id: ageId,
      title: detail.info.title,
      original_title: detail.info.original_title,
      alt_titles: detail.info.alt_titles,
      description: detail.info.description,
      cover_url: normalizeCoverUrl(detail.info.cover_url || '', 'agedm', ageId) || fallbackCover(ageId),
      region: detail.info.region,
      anime_type: detail.info.anime_type,
      status: detail.info.status,
      year: detail.info.year,
      genres: detail.info.genres,
      tags: detail.info.tags,
      studio: detail.info.studio,
      rating: detail.info.rating,
    }).catch(() => 0);

    if (animeId) {
      await db.replaceEpisodes(env.DB, animeId, detail.episodes).catch(() => {});
    }

    return json({
      ...animeRowToResponse({ ...detail.info, id: animeId, age_id: ageId }),
      episodes: detail.episodes.map(episodeToResponse),
    });
  }

  // ==================== /api/anime/gogo/:gogoId ====================
  const gogoMatch = path.match(/^\/api\/anime\/gogo\/(.+)$/);
  if (gogoMatch) {
    const gogoId = gogoMatch[1];
    let anime = await db.findAnimeByGogoId(env.DB, gogoId).catch(() => null);
    if (anime) {
      const episodes = await db.getEpisodesByAnimeId(env.DB, anime.id).catch(() => []);
      return json({ ...animeRowToResponse(anime), episodes: episodes.map(episodeToResponse) });
    }

    const detail = await gogoanime.getDetail(gogoId).catch(() => null);
    if (!detail) return json({ error: '未找到该动漫' }, 404);

    const animeId = await db.upsertAnime(env.DB, {
      source: 'gogoanime',
      gogo_id: gogoId,
      title: detail.info.title,
      description: detail.info.description,
      cover_url: detail.info.cover_url,
      genres: detail.info.genres,
      status: detail.info.status,
      year: detail.info.year,
      studio: detail.info.studio,
      rating: detail.info.rating,
    }).catch(() => 0);

    if (animeId) {
      await db.replaceEpisodes(env.DB, animeId, detail.episodes).catch(() => {});
    }

    return json({
      ...animeRowToResponse({ ...detail.info, id: animeId, gogo_id: gogoId }),
      episodes: detail.episodes.map(episodeToResponse),
    });
  }

  // ==================== /api/anime/:id (数字ID) ====================
  const idMatch = path.match(/^\/api\/anime\/(\d+)$/);
  if (idMatch) {
    const id = parseInt(idMatch[1]);
    const anime = await db.findAnimeById(env.DB, id).catch(() => null);
    if (!anime) return json({ error: '动漫不存在' }, 404);
    const episodes = await db.getEpisodesByAnimeId(env.DB, id).catch(() => []);
    return json({
      ...animeRowToResponse(anime),
      episodes: episodes.map(episodeToResponse),
    });
  }

  // ==================== /api/play/:ageId/:sourceIdx/:epNum ====================
  const playMatch = path.match(/^\/api\/play\/(\d+)\/(\d+)\/(\d+)$/);
  if (playMatch) {
    const [_, ageId, sourceIdx, epNum] = playMatch;
    return json({ url: `/api/video/${ageId}/${sourceIdx}/${epNum}` });
  }

  // ==================== /api/play/source/:sourceId/:episodeId ====================
  const playSourceMatch = path.match(/^\/api\/play\/source\/([^/]+)\/(\d+)$/);
  if (playSourceMatch) {
    const sourceId = playSourceMatch[1];
    const episodeId = parseInt(playSourceMatch[2]);
    const episode = await env.DB.prepare(
      'SELECT * FROM episode WHERE id = ?'
    ).bind(episodeId).first<any>().catch(() => null);

    if (!episode) return json({ error: '剧集不存在' }, 404);

    const sources = typeof episode.sources === 'string'
      ? JSON.parse(episode.sources) : (episode.sources || []);

    if (sources.length === 0) return json({ error: '无播放源' }, 404);

    const playUrl = sources[0].url || '';

    if (sourceId === 'gogoanime') {
      const videoUrl = await gogoanime.getPlayUrl(playUrl).catch(() => null);
      if (videoUrl) return json({ url: videoUrl, type: 'direct' });
      return json({ url: playUrl, type: 'page' });
    }

    return json({ url: playUrl, type: 'page' });
  }

  // ==================== /api/video/:ageId/:sourceIdx/:epNum ====================
  const videoMatch = path.match(/^\/api\/video\/(\d+)\/(\d+)\/(\d+)$/);
  if (videoMatch) {
    const [_, ageId, sourceIdx, epNum] = videoMatch;
    try {
      const playUrl = `https://www.agedm.io/play/${ageId}/${sourceIdx}/${epNum}`;
      const resp = await fetch(playUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.agedm.io/',
        },
      });

      if (!resp.ok) {
        return html('<html><body><h2>Load error</h2></body></html>', 502);
      }

      const respHtml = await resp.text();
      const iframeMatch = respHtml.match(/<iframe[^>]*id="iframeForVideo"[^>]*src=["']([^"']+)["']/i);

      if (!iframeMatch) {
        return html('<html><body><h2>Video not found</h2></body></html>', 404);
      }

      const videoSrc = iframeMatch[1];
      const playerResp = await fetch(videoSrc, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.agedm.io/',
        },
      });

      if (!playerResp.ok) {
        return html('<html><body><h2>Player load error</h2></body></html>', 502);
      }

      const playerHtml = await playerResp.text();

      const rewritten = playerHtml
        .replace(/src="\/\//g, 'src="https://')
        .replace(/href="\/\//g, 'href="https://')
        .replace(/src="\//g, 'src="https://jx.wuzhoupai.com:8443/')
        .replace(/href="\//g, 'href="https://jx.wuzhoupai.com:8443/');

      const finalHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;overflow:hidden;">
  <a href="/" style="position:fixed;top:8px;left:12px;z-index:99999;color:#ccc;text-decoration:none;font-family:system-ui;font-size:14px;background:rgba(0,0,0,0.7);padding:6px 12px;border-radius:6px;">DM动漫</a>
  <style>html,body{margin:0;padding:0;background:#000;overflow:hidden;width:100%;height:100%}iframe,video{width:100vw!important;height:100vh!important}</style>
  ${rewritten}
</body>
</html>`;

      return html(finalHtml);
    } catch (e: any) {
      return html(`<html><body><h2>Error</h2><p>${e.message}</p></body></html>`, 502);
    }
  }

  // ==================== /api/history/clear ====================
  if (path === '/api/history/clear' && method === 'POST') {
    const auth = request.headers.get('Authorization') || '';
    const user = await verifyJWT(auth);
    if (!user) return json({ error: '请先登录' }, 401);
    await db.clearHistory(env.DB, user.id).catch(() => {});
    return json({ message: '已清空' });
  }

  // ==================== /api/history/:id ====================
  const historyDelMatch = path.match(/^\/api\/history\/(\d+)$/);
  if (historyDelMatch && method === 'DELETE') {
    const auth = request.headers.get('Authorization') || '';
    const user = await verifyJWT(auth);
    if (!user) return json({ error: '请先登录' }, 401);
    const id = parseInt(historyDelMatch[1]);
    await db.deleteHistoryItem(env.DB, id, user.id).catch(() => {});
    return json({ message: '已删除' });
  }

  // ==================== /api/collections ====================
  if (path === '/api/collections') {
    if (method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const user = await verifyJWT(auth);
      const items = await db.listCollections(env.DB, user?.id).catch(() => []);
      return json(items.map(animeRowToResponse));
    }
  }

  // ==================== /api/collection/:animeId ====================
  const collectionMatch = path.match(/^\/api\/collection\/(\d+)$/);
  if (collectionMatch) {
    const auth = request.headers.get('Authorization') || '';
    const user = await verifyJWT(auth);
    if (!user) return json({ error: '请先登录' }, 401);
    const animeId = parseInt(collectionMatch[1]);
    if (method === 'POST') {
      await db.addCollection(env.DB, animeId, user.id).catch(() => {});
      return json({ message: '收藏成功' });
    }
    if (method === 'DELETE') {
      await db.removeCollection(env.DB, animeId, user.id).catch(() => {});
      return json({ message: '取消收藏' });
    }
  }

  // ==================== /api/history ====================
  if (path === '/api/history') {
    if (method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const user = await verifyJWT(auth);
      const items = await db.listHistory(env.DB, user?.id).catch(() => []);
      const enriched = await Promise.all(items.map(async (item: any) => {
        if (item.anime_id) {
          const anime = await db.findAnimeById(env.DB, item.anime_id).catch(() => null);
          if (anime) {
            return { ...item, age_id: anime.age_id, gogo_id: anime.gogo_id };
          }
        }
        return item;
      }));
      return json(enriched);
    }
    if (method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const user = await verifyJWT(auth);
      if (!user) return json({ message: 'ok' }); // 未登录静默跳过
      const data = await request.json();
      await db.saveHistory(env.DB, data, user.id).catch(() => {});
      return json({ message: 'ok' });
    }
  }

  // ==================== /cover/* (封面代理) ====================
  if (path.startsWith('/cover/')) {
    const coverPath = path.replace('/cover/', '');
    if (!coverPath) return json({ error: 'missing url' }, 400);

    const coverUrl = decodeURIComponent(coverPath);
    try {
      const resp = await fetch(coverUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.agedm.io/',
          'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
        },
      });
      if (!resp.ok) return new Response('', { status: 404 });

      const ct = resp.headers.get('Content-Type') || 'image/jpeg';
      const etag = resp.headers.get('ETag') || resp.headers.get('Last-Modified') || '';
      const headers: Record<string, string> = {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=604800, immutable',
        'Access-Control-Allow-Origin': '*',
      };
      if (etag) headers['ETag'] = etag;
      return new Response(resp.body, { headers });
    } catch {
      return new Response('', { status: 502 });
    }
  }

  // ==================== /api/r18/* (Hanime1.me R18) ====================

  // R18 最新
  if (path === '/api/r18/latest') {
    const page = parseInt(url.searchParams.get('page') || '1');
    const items = await hanime.getLatest(page).catch(() => [] as any[]);
    return json({ items });
  }

  // R18 搜索
  if (path === '/api/r18/search') {
    const keyword = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    if (!keyword) return json({ items: [] });
    const items = await hanime.search(keyword, page).catch(() => [] as any[]);
    return json({ items });
  }

  // R18 详情
  if (path === '/api/r18/detail') {
    const videoId = url.searchParams.get('v') || '';
    if (!videoId) return json({ error: '缺少 video id' }, 400);
    const detail = await hanime.getDetail(videoId).catch(() => null);
    if (!detail) return json({ error: '视频未找到' }, 404);
    return json(detail);
  }

  // R18 播放源
  if (path === '/api/r18/play') {
    const videoId = url.searchParams.get('v') || '';
    if (!videoId) return json({ error: '缺少 video id' }, 400);
    const detail = await hanime.getDetail(videoId).catch(() => null);
    if (!detail || detail.sources.length === 0) {
      return json({ error: '获取播放源失败' }, 404);
    }
    return json({
      video_id: detail.video_id,
      title: detail.title,
      cover_url: detail.cover_url,
      sources: detail.sources,
    });
  }

  // R18 视频代理（透传 MP4 + 防盗链）
  if (path === '/api/r18/video') {
    const videoUrl = url.searchParams.get('url') || '';
    if (!videoUrl) return json({ error: 'missing url' }, 400);

    try {
      const resp = await fetch(decodeURIComponent(videoUrl), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://hanime.io/',
        },
      });

      if (!resp.ok) {
        return json({ error: '获取视频失败', status: resp.status }, 502);
      }

      return new Response(resp.body, {
        headers: {
          'Content-Type': resp.headers.get('Content-Type') || 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e: any) {
      return json({ error: '视频代理错误', message: e.message }, 502);
    }
  }

  // R18 debug（临时）
  if (path === '/api/r18/debug') {
    try {
      const testUrl = url.searchParams.get('url') || 'https://hanime.io/';
      const resp = await fetch(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://hanime.io/',
        },
      });
      const html = await resp.text();

      // Search for body content
      const bodyMatch = html.match(/<body[^>]*>([\s\S]+?)<\/body>/i);
      const bodyStart = bodyMatch ? bodyMatch.index : -1;
      const bodyContent = bodyMatch ? bodyMatch[1] : '';

      // Search HTML for /anime/ patterns ANYWHERE (not just in links)
      const allSlugs = [...html.matchAll(/\/anime\/([^"'\s\/]+)/g)];
      const uniqueSlugs = [...new Set(allSlugs.map(x => x[1]))];

      // Look at tail of HTML
      const tail = html.substring(Math.max(0, html.length - 5000));
      const tailAnimeRefs = [...tail.matchAll(/\/anime\/([^"'\s\/]+)/g)];

      // Look at mid-body (50% into body)
      const bodyThirdStart = bodyContent ? bodyContent.length * 0.5 : 0;
      const bodyMid = bodyContent ? bodyContent.substring(bodyThirdStart, bodyThirdStart + 3000) : '';

      return json({
        status: resp.status,
        length: html.length,
        bodyStart,
        bodyLength: bodyContent.length,
        uniqueSlugs: uniqueSlugs.slice(0, 30),
        tailAnimeCount: tailAnimeRefs.length,
        midBodySample: bodyMid,
        tailEnd: html.substring(html.length - 2000),
      });
    } catch (e: any) {
      return json({ error: e.message });
    }
  }

  // ==================== 404 ====================
  return json({ error: 'Not found' }, 404);
}

// ==================== 辅助函数 ====================

function animeRowToResponse(a: any): any {
  return {
    id: a.id,
    source: a.source,
    age_id: a.age_id,
    gogo_id: a.gogo_id,
    title: a.title,
    original_title: a.original_title,
    alt_titles: a.alt_titles,
    description: a.description,
    cover_url: a.cover_url || (a.age_id ? fallbackCover(a.age_id) : ''),
    region: a.region,
    anime_type: a.anime_type,
    status: a.status,
    year: a.year,
    genres: a.genres,
    tags: a.tags,
    studio: a.studio,
    rating: a.rating,
  };
}

function episodeToResponse(ep: any): any {
  return {
    id: ep.id,
    anime_id: ep.anime_id,
    episode_number: ep.episode_number,
    source: ep.source,
    title: ep.title,
    sources: typeof ep.sources === 'string' ? JSON.parse(ep.sources) : (ep.sources || []),
  };
}
