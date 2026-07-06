import axios from 'axios'

// 原生 App / Electron / file:// 环境需要完整的 API 地址
const PROD_API = 'https://l-anime.pages.dev'

function needsFullApi() {
  if (typeof window === 'undefined') return false
  // Capacitor 原生环境
  if (window.Capacitor && window.Capacitor.isNativePlatform()) return true
  // Electron 环境（preload 注入）
  if (window.electron && window.electron.isElectron) return true
  // 兜底：file:// 协议（Electron 打包后 preload 未正确注入时）
  if (window.location.protocol === 'file:') return true
  return false
}

const isNative = needsFullApi()

const api = axios.create({
  baseURL: isNative ? PROD_API + '/api' : '/api',
  timeout: 30000,
})

// 自动附带 JWT token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('lanime_token')
  if (token) {
    config.headers.Authorization = 'Bearer ' + token
  }
  return config
})

export { api }

// 占位图 — 桌面端用完整 URL，web 端用相对路径
export const PLACEHOLDER_URL = isNative
  ? PROD_API + '/placeholder-cover.svg'
  : '/placeholder-cover.svg'

// 封面 URL 处理
export function getCoverUrl(item) {
  if (!item || !item.cover_url) return ''

  // CDN 兜底封面
  if (item.age_id && (!item.cover_url || item.cover_url.includes('placeholder') || item.cover_url.includes('bdxiguaimg'))) {
    return `https://cdn.aqdstatic.com:966/age/${item.age_id}.jpg`
  }

  const url = item.cover_url

  // 公开 CDN 直连
  if (url.includes('aqdstatic.com') || url.includes('aqdm.cc')) return url

  // agedm.io 防盗链 — 必须走代理
  if (url.includes('agedm.io') || url.includes('agedm.org')) {
    return apiUrl('/cover/' + encodeURIComponent(url))
  }

  if (url.startsWith('http')) return url
  if (url.startsWith('//')) return 'https:' + url
  if (url.startsWith('/')) return 'https://www.agedm.io' + url
  return url
}

// 封面加载失败时的兜底 — 尝试走代理重试
export function getCoverFallbackUrl(originalUrl) {
  if (!originalUrl || originalUrl === PLACEHOLDER_URL) return PLACEHOLDER_URL
  // 已经走代理的不再重试
  if (originalUrl.includes('/cover/')) return PLACEHOLDER_URL
  // 重试走代理
  return apiUrl('/cover/' + encodeURIComponent(originalUrl))
}

export function getHomeData() {
  return api.get('/anime/home')
}

export function searchAnime(keyword, page = 1) {
  return api.get('/anime/search', { params: { keyword, page } })
}

export function getAnimeDetail(id) {
  return api.get('/anime/' + id)
}

export function getAnimeByAgeId(ageId) {
  return api.get('/anime/age/' + ageId)
}

export function searchYhdm(keyword) {
  return api.get('/anime/yhdm/search', { params: { keyword } })
}

export function searchFcm(keyword) {
  return api.get('/anime/fcm/search', { params: { keyword } })
}

export function getAnimeByYhdmId(yhdmId) {
  return api.get('/anime/yhdm/' + yhdmId)
}

export function getAnimeByFcmId(fcmId) {
  return api.get('/anime/fcm/' + fcmId)
}

// 在原生 App 中把相对路径转成完整 URL
export function apiUrl(path) {
  return isNative ? PROD_API + path : path
}

export function getYhdmPlayUrl(playPath) {
  return apiUrl('/api/play/yhdm' + playPath)
}

export function getFcmPlayUrl(playPath) {
  return apiUrl('/api/play/fcm' + playPath)
}

export function getPlayUrl(ageId, sourceIdx, epNum) {
  return api.get('/play/' + ageId + '/' + sourceIdx + '/' + epNum)
}

export function getProxyPlayUrl(ageId, sourceIdx, epNum) {
  return apiUrl('/api/video/' + ageId + '/' + sourceIdx + '/' + epNum)
}

export function getDirectAgedmUrl(ageId, sourceIdx, epNum) {
  return 'https://www.agedm.io/play/' + ageId + '/' + sourceIdx + '/' + epNum
}

export function getSourcePlayUrl(sourceId, episodeId) {
  return apiUrl('/api/play/source/' + sourceId + '/' + episodeId)
}

export function getSources() {
  return api.get('/sources')
}

// ==================== R18 / Hanime API ====================

export function r18Search(keyword, page = 1) {
  return api.get('/r18/search', { params: { q: keyword, page } })
}

export function r18Latest(genre = '里番', page = 1) {
  return api.get('/r18/latest', { params: { genre, page } })
}

export function r18Categories() {
  return api.get('/r18/categories')
}

export function r18Detail(videoId) {
  return api.get('/r18/detail', { params: { v: videoId } })
}

export function r18PlayUrl(videoId) {
  return api.get('/r18/play', { params: { v: videoId } })
}

export function r18VideoProxyUrl(mp4Url) {
  return apiUrl('/api/r18/video?url=' + encodeURIComponent(mp4Url))
}


export function addCollection(animeId) {
  return api.post('/collection/' + animeId)
}

export function removeCollection(animeId) {
  return api.delete('/collection/' + animeId)
}

export function getCollections() {
  return api.get('/collections')
}

export function getHistory() {
  return api.get('/history')
}

export function saveHistory(data) {
  return api.post('/history', data)
}
