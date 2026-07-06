<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAnimeByAgeId, getAnimeByYhdmId, getAnimeByFcmId, getAnimeDetail, getProxyPlayUrl, getYhdmPlayUrl, getFcmPlayUrl, getHomeData, saveHistory, getCoverUrl, PLACEHOLDER_URL } from '../api/index.js'

const route = useRoute()
const router = useRouter()

const playUrl = ref('')
const loading = ref(true)
const error = ref('')
const playerType = ref('')

const anime = ref(null)
const episodes = ref([])
const currentEpNum = ref(1)
const currentSourceIdx = ref(0)
const relatedAnime = ref([])

// 当前源名称
const currentSourceName = computed(() => {
  if (playerType.value === 'yhdm') return '🌸 樱花'
  if (playerType.value === 'fcm') return '🎡 风车'
  if (playerType.value === 'proxy') return 'AGE'
  return ''
})

const availableSources = computed(() => {
  if (!episodes.value.length) return []
  const firstEp = episodes.value[0]
  if (!firstEp.sources || !firstEp.sources.length) return []
  return firstEp.sources.map((s, i) => ({ name: s.name, index: i }))
})

function updatePlayUrl() {
  const { params } = route
  const a = anime.value
  if (!a) return
  if (a.age_id) {
    playUrl.value = getProxyPlayUrl(params.ageId, currentSourceIdx.value + 1, currentEpNum.value)
  }
}

const yhdmVideoUrl = ref('')
const fcmVideoUrl = ref('')

async function loadYhdmVideo() {
  const a = anime.value
  if (!a || !a.yhdm_id) return
  const ep = episodes.value.find(e => e.episode_number === currentEpNum.value)
  if (!ep || !ep.sources || !ep.sources[0]) return
  try {
    const playPath = ep.sources[0].url ? new URL(ep.sources[0].url).pathname : ''
    if (!playPath) return
    const resp = await fetch(getYhdmPlayUrl(playPath))
    const data = await resp.json()
    if (data.url) {
      yhdmVideoUrl.value = data.url
    }
  } catch { /* */ }
}

async function loadFcmVideo() {
  const a = anime.value
  if (!a || !a.fcm_id) return
  const ep = episodes.value.find(e => e.episode_number === currentEpNum.value)
  if (!ep || !ep.sources || !ep.sources[0]) return
  try {
    const playPath = ep.sources[0].url ? new URL(ep.sources[0].url).pathname : ''
    if (!playPath) return
    const resp = await fetch(getFcmPlayUrl(playPath))
    const data = await resp.json()
    if (data.url) {
      fcmVideoUrl.value = data.url
    }
  } catch { /* */ }
}

async function loadCurrentAnime() {
  const { name, params } = route
  try {
    let animeData = null
    if (name === 'Play' && params.ageId) {
      const res = await getAnimeByAgeId(params.ageId); animeData = res.data
      currentEpNum.value = parseInt(params.epNum)
      currentSourceIdx.value = Math.max(0, (parseInt(params.sourceIdx) || 1) - 1)
      playerType.value = 'proxy'
    } else if (name === 'PlayYhdm' && params.yhdmId) {
      const res = await getAnimeByYhdmId(params.yhdmId); animeData = res.data
      currentEpNum.value = parseInt(params.epNum)
      playerType.value = 'yhdm'
    } else if (name === 'PlayFcm' && params.fcmId) {
      const res = await getAnimeByFcmId(params.fcmId); animeData = res.data
      currentEpNum.value = parseInt(params.epNum)
      playerType.value = 'fcm'
    } else if (name === 'PlayLegacy') {
      const res = await getAnimeDetail(params.sourceId); animeData = res.data
    }
    if (animeData) {
      anime.value = { ...animeData, cover_url: getCoverUrl(animeData) }
      episodes.value = animeData.episodes || []
      updatePlayUrl()
      if (playerType.value === 'yhdm') loadYhdmVideo()
      if (playerType.value === 'fcm') loadFcmVideo()
    }
    try {
      const home = await getHomeData()
      const items = home.data || []
      relatedAnime.value = items.filter(item => item.title !== animeData?.title).slice(0, 12).map(item => ({ ...item, cover_url: getCoverUrl(item) }))
    } catch(e) {}
    saveHistoryEntry()
  } catch(e) { error.value = '加载失败'; console.error(e) }
  finally { loading.value = false }
}

function saveHistoryEntry() {
  const a = anime.value
  if (!a || !a.id) return
  saveHistory({ anime_id: a.id, episode_number: currentEpNum.value, anime_title: a.title || '', episode_title: '第 ' + currentEpNum.value + ' 集', cover_url: a.cover_url || '', source_index: currentSourceIdx.value }).catch(() => {})
}

onMounted(loadCurrentAnime)

watch(() => route.params, async () => {
  loading.value = true; playUrl.value = ''; error.value = ''
  await loadCurrentAnime()
})

function switchSource(idx) {
  currentSourceIdx.value = idx
  const a = anime.value
  if (!a) return
  if (a.age_id) router.push('/play/age/' + a.age_id + '/' + (idx + 1) + '/' + currentEpNum.value)
  else if (a.yhdm_id) router.push('/play/yhdm/' + a.yhdm_id + '/' + currentEpNum.value)
  else if (a.fcm_id) router.push('/play/fcm/' + a.fcm_id + '/' + currentEpNum.value)
}

function switchEpisode(ep) {
  const a = anime.value
  if (!a) return
  currentEpNum.value = ep.episode_number
  if (a.age_id) router.push('/play/age/' + a.age_id + '/' + (currentSourceIdx.value + 1) + '/' + ep.episode_number)
  else if (a.yhdm_id) router.push('/play/yhdm/' + a.yhdm_id + '/' + ep.episode_number)
  else if (a.fcm_id) router.push('/play/fcm/' + a.fcm_id + '/' + ep.episode_number)
}

function goBack() {
  const a = anime.value
  if (a?.age_id) router.push('/detail/age/' + a.age_id)
  else if (a?.yhdm_id) router.push('/detail/yhdm/' + a.yhdm_id)
  else if (a?.fcm_id) router.push('/detail/fcm/' + a.fcm_id)
  else router.push('/')
}

function goDetail(item) {
  if (item.id && item.id !== 0) router.push('/detail/' + item.id)
  else if (item.age_id || item.source_id) router.push('/detail/age/' + (item.age_id || item.source_id))
}
</script>

<template>
  <div class="play-page">
    <!-- Header -->
    <div class="play-header">
      <button class="back-btn" @click="goBack">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3L4 7l4 4"/></svg>
        <span>返回</span>
      </button>
      <div class="play-title-info" v-if="anime">
        <router-link :to="anime.age_id ? '/detail/age/' + anime.age_id : anime.yhdm_id ? '/detail/yhdm/' + anime.yhdm_id : anime.fcm_id ? '/detail/fcm/' + anime.fcm_id : '/detail/' + anime.id" class="anime-title-link">{{ anime.title }}</router-link>
        <span class="dot">·</span>
        <span class="ep-label">第 {{ currentEpNum }} 集</span>
        <span class="source-badge" v-if="currentSourceName">{{ currentSourceName }}</span>
      </div>
    </div>

    <div class="play-layout">
      <!-- Left Main -->
      <div class="play-main">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载播放器...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <p class="error-text">{{ error }}</p>
          <button class="btn btn-primary" @click="goBack">返回</button>
        </div>

        <template v-else>
          <!-- Source Tabs -->
          <div class="source-tabs" v-if="availableSources.length > 0">
            <span class="source-label">片源</span>
            <button v-for="(src, i) in availableSources" :key="i" :class="['source-tab', { active: currentSourceIdx === src.index }]" @click="switchSource(src.index)">{{ src.name }}</button>
          </div>

          <!-- Video Player -->
          <div class="video-container">
            <iframe v-if="playerType === 'proxy'" :src="playUrl" class="player-iframe" allowfullscreen allow="autoplay; fullscreen" frameborder="0" @load="loading = false"></iframe>
            <video v-else-if="playerType === 'direct'" :src="playUrl" class="player-video" controls autoplay></video>
            <div v-else-if="playerType === 'yhdm'" class="yhdm-player">
            <video v-if="yhdmVideoUrl"
              :src="yhdmVideoUrl"
              class="player-video"
              controls
              autoplay
            ></video>
            <div v-else class="placeholder-state">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><polygon points="12,6 30,18 12,30"/></svg>
              <p>正在获取樱花动漫播放源...</p>
            </div>
          </div>
          <div v-else-if="playerType === 'fcm'" class="fcm-player">
            <video v-if="fcmVideoUrl"
              :src="fcmVideoUrl"
              class="player-video"
              controls
              autoplay
            ></video>
            <div v-else class="placeholder-state">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><polygon points="12,6 30,18 12,30"/></svg>
              <p>正在获取风车动漫播放源...</p>
            </div>
          </div>
          <div v-else-if="playerType === 'redirect'" class="placeholder-state">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M18 12v12M12 18h12"/><path d="M5 18a13 13 0 1126 0 13 13 0 01-26 0z"/></svg>
              <p>该源需跳转播放</p>
              <a :href="playUrl" target="_blank" class="btn btn-primary">前往</a>
            </div>
            <div v-else class="placeholder-state">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><rect x="4" y="6" width="28" height="22" rx="3"/><polygon points="14,12 26,18 14,24"/></svg>
              <p>暂无可用播放源</p>
            </div>
          </div>

          <!-- Episode Selector -->
          <div class="episode-area">
            <h3 class="area-title">选择剧集</h3>
            <div v-if="episodes.length > 0" class="episode-grid">
              <button v-for="ep in episodes" :key="ep.id || ep.episode_number" :class="['ep-btn', { active: ep.episode_number === currentEpNum }]" @click="switchEpisode(ep)">
                {{ ep.episode_number }}
              </button>
            </div>
            <div v-else class="no-eps">暂无剧集</div>
          </div>
        </template>
      </div>

      <!-- Right Sidebar -->
      <div class="play-sidebar" v-if="relatedAnime.length > 0">
        <h3 class="sidebar-title">猜你喜欢</h3>
        <div class="sidebar-list">
          <div v-for="item in relatedAnime" :key="item.age_id || item.gogo_id || item.title" class="sidebar-card" @click="goDetail(item)">
            <div class="sidebar-cover">
              <img :src="item.cover_url || PLACEHOLDER_URL" :alt="item.title" loading="lazy" />
            </div>
            <div class="sidebar-info">
              <div class="sidebar-name">{{ item.title }}</div>
              <div v-if="item.genres" class="sidebar-genre">{{ item.genres.slice(0, 16) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.play-page { min-height: 100vh; background: var(--bg-abyss); }

/* Header */
.play-header {
  display: flex; align-items: center; gap: 16px; padding: 12px 24px;
  background: rgba(12, 11, 24, 0.9); backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle); position: sticky; top: 0; z-index: 50;
}
.back-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  color: var(--text-secondary); padding: 5px 12px; border-radius: 18px;
  font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.25s; font-family: inherit;
  flex-shrink: 0;
}
.back-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.play-title-info { display: flex; align-items: center; gap: 8px; font-size: 14px; flex-wrap: wrap; }
.anime-title-link { color: #fff; text-decoration: none; font-weight: 700; transition: 0.2s; }
.anime-title-link:hover { color: var(--sakura-light); }
.dot { color: var(--text-dim); }
.ep-label { color: var(--text-secondary); font-weight: 500; }
.source-badge {
  background: var(--pink-blue); color: #fff; font-size: 11px; font-weight: 600;
  padding: 2px 10px; border-radius: 12px; margin-left: 8px;
}

/* Layout */
.play-layout { max-width: 1280px; margin: 0 auto; padding: 20px 24px 60px; display: flex; gap: 24px; }
.play-main { flex: 1; min-width: 0; }
.play-sidebar { width: 260px; flex-shrink: 0; }

/* Source Tabs */
.source-tabs { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.source-label { font-size: 11px; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.source-tab {
  background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 18px;
  color: var(--text-secondary); padding: 5px 14px; font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all 0.25s var(--ease-out); font-family: inherit;
}
.source-tab:hover { color: #fff; border-color: var(--border-glow); }
.source-tab.active { background: var(--pink-blue); border-color: transparent; color: #fff; font-weight: 700; box-shadow: 0 2px 14px var(--sakura-glow); }

/* Video */
.video-container {
  position: relative; width: 100%; aspect-ratio: 16/9; background: #000;
  border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 24px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
}
.player-iframe, .player-video { width: 100%; height: 100%; border: none; display: block; }
.placeholder-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 14px; color: var(--text-muted); font-size: 14px; }
/* Episodes */
.episode-area { margin-bottom: 32px; }
.area-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 14px; }
.episode-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 8px; }
.ep-btn {
  aspect-ratio: 1; background: var(--bg-card); border: 1px solid var(--border-card);
  border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all 0.2s var(--ease-out); display: flex; align-items: center;
  justify-content: center; font-family: inherit;
}
.ep-btn:hover { background: var(--bg-card-hover); border-color: var(--sakura); color: #fff; transform: translateY(-1px); }
.ep-btn.active { background: var(--pink-blue); border-color: transparent; color: #fff; font-weight: 700; box-shadow: 0 2px 16px var(--sakura-glow); }
.no-eps { color: var(--text-dim); text-align: center; padding: 24px; font-size: 14px; }

/* Sidebar */
.sidebar-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle); }
.sidebar-list { display: flex; flex-direction: column; gap: 6px; }
.sidebar-card {
  display: flex; gap: 10px; padding: 8px; border-radius: var(--radius-md);
  cursor: pointer; transition: all 0.25s var(--ease-out); border: 1px solid transparent;
}
.sidebar-card:hover { background: var(--bg-card); border-color: var(--border-card); }
.sidebar-cover { width: 52px; height: 74px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; }
.sidebar-cover img { width: 100%; height: 100%; object-fit: cover; }
.sidebar-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.sidebar-name { font-size: 12px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-genre { font-size: 10px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* States */
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; gap: 14px; color: var(--text-muted); }
.spinner { width: 36px; height: 36px; border: 2px solid var(--border-subtle); border-top-color: var(--sakura); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; gap: 16px; }
.error-text { color: var(--sakura-light); font-size: 16px; }

@media (max-width: 1024px) {
  .play-layout { flex-direction: column; }
  .play-sidebar { width: 100%; }
  .sidebar-list { flex-direction: row; overflow-x: auto; gap: 10px; padding-bottom: 6px; }
  .sidebar-card { flex-direction: column; min-width: 110px; }
  .sidebar-cover { width: 100%; height: 150px; }
}
@media (max-width: 768px) {
  .play-header { padding: 10px 14px; }
  .play-layout { padding: 14px 12px 40px; }
  .video-container { border-radius: 0; }
}
</style>
