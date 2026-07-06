// ===== 类型定义 =====

export interface AnimeItem {
  source: string;
  source_id: string;
  title: string;
  original_title?: string;
  alt_titles?: string;
  description?: string;
  cover_url?: string;
  region?: string;
  anime_type?: string;
  status?: string;
  year?: string;
  genres?: string;
  tags?: string;
  studio?: string;
  rating?: number;
  status_text?: string;
  rank?: number;
  views?: string;
}

export interface EpisodeItem {
  source: string;
  episode_number: number;
  title?: string;
  source_id?: string;
  sources?: Array<{ name: string; url: string }>;
}

export interface AnimeDetail {
  info: AnimeItem;
  episodes: EpisodeItem[];
}

export interface D1Anime {
  id: number;
  age_id: string | null;
  gogo_id: string | null;
  mal_id: number | null;
  source: string;
  title: string;
  original_title: string;
  alt_titles: string;
  description: string;
  cover_url: string;
  region: string;
  anime_type: string;
  status: string;
  year: string;
  genres: string;
  tags: string;
  studio: string;
  rating: number;
  view_count: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface D1Episode {
  id: number;
  anime_id: number;
  episode_number: number;
  source: string;
  title: string;
  sources: string;
  created_at: string;
}

export interface Env {
  DB: D1Database;
}
