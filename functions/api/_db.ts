// D1 数据库操作层 — 单源版
import type { D1Anime, D1Episode } from './_types';

// ========== Anime CRUD ==========

export async function findAnimeByAgeId(db: D1Database, ageId: string): Promise<D1Anime | null> {
  const row = await db.prepare('SELECT * FROM anime WHERE age_id = ?').bind(ageId).first<D1Anime>();
  return row || null;
}

export async function findAnimeByGogoId(db: D1Database, gogoId: string): Promise<D1Anime | null> {
  const row = await db.prepare('SELECT * FROM anime WHERE gogo_id = ?').bind(gogoId).first<D1Anime>();
  return row || null;
}

export async function findAnimeById(db: D1Database, id: number): Promise<D1Anime | null> {
  const row = await db.prepare('SELECT * FROM anime WHERE id = ?').bind(id).first<D1Anime>();
  return row || null;
}

export async function searchLocalAnime(db: D1Database, keyword: string): Promise<D1Anime[]> {
  const like = `%${keyword}%`;
  const { results } = await db.prepare(
    'SELECT * FROM anime WHERE title LIKE ? OR original_title LIKE ? ORDER BY view_count DESC LIMIT 50'
  ).bind(like, like).all<D1Anime>();
  return results || [];
}

export async function upsertAnime(db: D1Database, data: any): Promise<number> {
  let existing: D1Anime | null = null;

  if (data.source === 'gogoanime' && data.source_id) {
    existing = await findAnimeByGogoId(db, data.source_id);
  } else if (data.age_id) {
    existing = await findAnimeByAgeId(db, data.age_id);
  }

  if (existing) {
    await db.prepare(`
      UPDATE anime SET
        title = ?, original_title = ?, alt_titles = ?, description = ?,
        cover_url = ?, region = ?, anime_type = ?, status = ?, year = ?,
        genres = ?, tags = ?, studio = ?, rating = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      data.title || existing.title,
      data.original_title || existing.original_title || '',
      data.alt_titles || existing.alt_titles || '',
      data.description || existing.description || '',
      data.cover_url || existing.cover_url || '',
      data.region || existing.region || '',
      data.anime_type || existing.anime_type || '',
      data.status || existing.status || '',
      data.year || existing.year || '',
      data.genres || existing.genres || '',
      data.tags || existing.tags || '',
      data.studio || existing.studio || '',
      data.rating || existing.rating || 0,
      existing.id
    ).run();
    return existing.id;
  }

  const result = await db.prepare(`
    INSERT INTO anime (age_id, gogo_id, mal_id, source, title, original_title, alt_titles,
      description, cover_url, region, anime_type, status, year, genres, tags, studio, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.age_id || null, data.gogo_id || null, data.mal_id || null,
    data.source || 'agedm',
    data.title, data.original_title || '', data.alt_titles || '',
    data.description || '', data.cover_url || '', data.region || '',
    data.anime_type || '', data.status || '', data.year || '',
    data.genres || '', data.tags || '', data.studio || '', data.rating || 0
  ).run();

  return Number(result.meta.last_row_id);
}

export async function upsertAnimeFast(db: D1Database, data: any): Promise<number> {
  let existing: D1Anime | null = null;
  if (data.gogo_id) {
    existing = await findAnimeByGogoId(db, data.gogo_id);
  } else if (data.age_id) {
    existing = await findAnimeByAgeId(db, data.age_id);
  }
  if (existing) {
    return existing.id;
  }

  const result = await db.prepare(`
    INSERT INTO anime (age_id, gogo_id, source, title, original_title, alt_titles,
      description, cover_url, region, anime_type, status, year, genres, studio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.age_id || null, data.gogo_id || null,
    data.source || 'agedm',
    data.title, data.original_title || '', data.alt_titles || '',
    data.description || '', data.cover_url || '', data.region || '',
    data.anime_type || '', data.status || '', data.year || '',
    data.genres || '', data.studio || ''
  ).run();

  return Number(result.meta.last_row_id);
}

// ========== Episode CRUD ==========

export async function getEpisodesByAnimeId(db: D1Database, animeId: number): Promise<D1Episode[]> {
  const { results } = await db.prepare(
    'SELECT * FROM episode WHERE anime_id = ? ORDER BY episode_number ASC'
  ).bind(animeId).all<D1Episode>();
  return results || [];
}

export async function replaceEpisodes(db: D1Database, animeId: number, episodes: any[]) {
  await db.prepare('DELETE FROM episode WHERE anime_id = ?').bind(animeId).run();

  for (const ep of episodes) {
    await db.prepare(`
      INSERT INTO episode (anime_id, episode_number, source, title, sources)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      animeId, ep.episode_number, ep.source || 'agedm',
      ep.title || '', JSON.stringify(ep.sources || [])
    ).run();
  }
}

// ========== Collection CRUD ==========

export async function addCollection(db: D1Database, animeId: number, userId?: number) {
  if (!userId) return;
  await db.prepare('INSERT OR IGNORE INTO collection (anime_id, user_id) VALUES (?, ?)').bind(animeId, userId).run();
}

export async function removeCollection(db: D1Database, animeId: number, userId?: number) {
  if (!userId) return;
  await db.prepare('DELETE FROM collection WHERE anime_id = ? AND user_id = ?').bind(animeId, userId).run();
}

export async function listCollections(db: D1Database, userId?: number): Promise<D1Anime[]> {
  if (!userId) return [];
  const { results } = await db.prepare(`
    SELECT a.* FROM anime a
    INNER JOIN collection c ON c.anime_id = a.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `).bind(userId).all<D1Anime>();
  return results || [];
}

// ========== History CRUD ==========

export async function listHistory(db: D1Database, userId?: number): Promise<any[]> {
  if (!userId) return [];
  const { results } = await db.prepare(
    'SELECT * FROM history WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100'
  ).bind(userId).all();
  return results || [];
}

export async function saveHistory(db: D1Database, data: any, userId?: number) {
  if (!userId) return;
  // 按 anime_id + user_id 去重：同一用户同一动漫只保留最新观看记录
  const existing = await db.prepare(
    'SELECT id FROM history WHERE anime_id = ? AND user_id = ?'
  ).bind(data.anime_id, userId).first();

  if (existing) {
    await db.prepare(`
      UPDATE history SET
        episode_id = ?, episode_title = ?, episode_number = ?,
        source_index = ?, progress = ?, duration = ?,
        cover_url = ?, anime_title = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      data.episode_id || null, data.episode_title || '',
      data.episode_number || 1, data.source_index || 0,
      data.progress || 0, data.duration || 0,
      data.cover_url || '', data.anime_title || '',
      existing.id
    ).run();
  } else {
    await db.prepare(`
      INSERT INTO history (anime_id, user_id, episode_id, anime_title, episode_title,
        cover_url, episode_number, source_index, progress, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.anime_id, userId, data.episode_id || null, data.anime_title || '',
      data.episode_title || '', data.cover_url || '',
      data.episode_number || 1, data.source_index || 0,
      data.progress || 0, data.duration || 0
    ).run();
  }
}

export async function deleteHistoryItem(db: D1Database, id: number, userId?: number) {
  if (!userId) return;
  await db.prepare('DELETE FROM history WHERE id = ? AND user_id = ?').bind(id, userId).run();
}

export async function clearHistory(db: D1Database, userId?: number) {
  if (!userId) return;
  await db.prepare('DELETE FROM history WHERE user_id = ?').bind(userId).run();
}
