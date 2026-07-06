<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAnimeDetail, getAnimeByAgeId, getAnimeByYhdmId, getAnimeByFcmId, searchYhdm, searchFcm, getCoverUrl, PLACEHOLDER_URL, getCoverFallbackUrl } from '../api/index.js'

const route = useRoute()
const router = useRouter()
const anime = ref(null)
const episodes = ref([])
const loading = ref(true)
const isCollapsed = ref(false)
const currentSourceIdx = ref(0)

// yhdm 附加源
const yhdmEpisodes = ref([])
const yhdmAnimeId = ref('')

// fengchedm 附加源
const fcmEpisodes = ref([])
const fcmAnimeId = ref('')

const allSources = computed(() => {
  const sources = []
  // AGE 源
  if (episodes.value.length) {
    const firstEp = episodes.value[0]
    if (firstEp.sources?.length) {
      firstEp.sources.forEach((s, i) => sources.push({ name: s.name, index: i }))
    }
  }
  // 樱花源
  if (yhdmEpisodes.value.length) {
    sources.push({ name: '🌸 樱花', index: -1 })
  }
  // 风车源
  if (fcmEpisodes.value.length) {
    sources.push({ name: '🎡 风车', index: -2 })
  }
  return sources
})

// 当前显示的剧集列表（根据选中的源）
const activeEpisodes = computed(() => {
  if (currentSourceIdx.value === -1) return yhdmEpisodes.value
  if (currentSourceIdx.value === -2) return fcmEpisodes.value
  return episodes.value
})

onMounted(async () => {
  try {
    let data
    const { name, params } = route
    if (name === 'DetailAge' && params.ageId) {
      const res = await getAnimeByAgeId(params.ageId); data = res.data
    } else if (name === 'DetailYhdm' && params.yhdmId) {
      const res = await getAnimeByYhdmId(params.yhdmId); data = res.data
    } else if (name === 'DetailFcm' && params.fcmId) {
      const res = await getAnimeByFcmId(params.fcmId); data = res.data
    } else if (params.id) {
      const res = await getAnimeDetail(params.id); data = res.data
    }
    if (data) {
      anime.value = { ...data, cover_url: getCoverUrl(data) }
      episodes.value = data.episodes || []
      loadCollections()
      // 异步拉樱花源和风车源
      loadYhdmSource(data.title)
      loadFcmSource(data.title)
    }
  } catch (e) { console.error(e) }
  finally { loading.value = false }
})

async function loadYhdmSource(title) {
  try {
    const { data } = await searchYhdm(title)
    const items = data.items || []
    if (items.length) {
      const first = items[0]
      const detail = await getAnimeByYhdmId(first.source_id)
      if (detail.data?.episodes?.length) {
        yhdmEpisodes.value = detail.data.episodes
        yhdmAnimeId.value = first.source_id
        yhdmEpisodes.value.forEach(ep => {
          ep._yhdm = true
          if (!ep.sources?.length) ep.sources = [{ name: 'YHDM', url: '' }]
        })
      }
    }
  } catch { /* 樱花源加载失败不影响主源 */ }
}

async function loadFcmSource(title) {
  try {
    const { data } = await searchFcm(title)
    const items = data.items || []
    if (items.length) {
      const first = items[0]
      const detail = await getAnimeByFcmId(first.source_id)
      if (detail.data?.episodes?.length) {
        fcmEpisodes.value = detail.data.episodes
        fcmAnimeId.value = first.source_id
        fcmEpisodes.value.forEach(ep => {
          ep._fcm = true
          if (!ep.sources?.length) ep.sources = [{ name: 'FCM', url: '' }]
        })
      }
    }
  } catch { /* 风车源加载失败不影响主源 */ }
}

function switchSource(idx) { currentSourceIdx.value = idx }

function playEpisode(ep) {
  const a = anime.value
  if (ep._yhdm && yhdmAnimeId.value) {
    router.push('/play/yhdm/' + yhdmAnimeId.value + '/' + ep.episode_number)
  } else if (ep._fcm && fcmAnimeId.value) {
    router.push('/play/fcm/' + fcmAnimeId.value + '/' + ep.episode_number)
  } else if (a.fcm_id) {
    router.push('/play/fcm/' + a.fcm_id + '/' + ep.episode_number)
  } else if (a.yhdm_id) {
    router.push('/play/yhdm/' + a.yhdm_id + '/' + ep.episode_number)
  } else if (a.age_id) {
    router.push('/play/age/' + a.age_id + '/' + (currentSourceIdx.value + 1) + '/' + ep.episode_number)
  }
}

function goBack() { router.back() }

const isCollected = ref(false)

function loadCollections() {
  try {
    const raw = localStorage.getItem('lanime-collections')
    const list = raw ? JSON.parse(raw) : []
    const a = anime.value
    if (a) {
      const key = a.age_id || a.gogo_id || a.id
      isCollected.value = list.some((item) => item.key === key)
    }
  } catch {}
}

function toggleCollection() {
  const a = anime.value
  if (!a) return
  const key = a.age_id || a.gogo_id || a.id
  const entry = { key, age_id: a.age_id, gogo_id: a.gogo_id, title: a.title, cover_url: a.cover_url, rating: a.rating, year: a.year, source: a.source }
  try {
    const raw = localStorage.getItem('lanime-collections')
    const list = raw ? JSON.parse(raw) : []
    if (isCollected.value) {
      const idx = list.findIndex((item) => item.key === key)
      if (idx !== -1) list.splice(idx, 1)
      localStorage.setItem('lanime-collections', JSON.stringify(list))
      isCollected.value = false
    } else {
      list.unshift(entry)
      localStorage.setItem('lanime-collections', JSON.stringify(list))
      isCollected.value = true
    }
  } catch {}
}

setTimeout(() => { if (anime.value) loadCollections() }, 100)
function onImgError(e) {
  const fallback = getCoverFallbackUrl(e.target.dataset.original || e.target.src)
  if (fallback !== e.target.src) {
    e.target.dataset.original = e.target.dataset.original || e.target.src
    e.target.src = fallback
  } else {
    e.target.src = PLACEHOLDER_URL
  }
}
</script>

<template>
  <div class="detail-page">
    <div v-if="loading" class="loading">加载中...</div>
    <template v-else-if="anime">
      <!-- Hero Banner -->
      <div class="detail-hero">
        <div class="hero-bg-img">
          <img :src="anime.cover_url || PLACEHOLDER_URL" :alt="anime.title" @error="onImgError" />
          <div class="hero-bg-veil"></div>
        </div>
        <div class="hero-body container">
          <button class="back-btn" @click="goBack">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 3L5 7l4 4"/></svg>
            <span>返回</span>
          </button>
          <div class="hero-layout">
            <div class="hero-cover-col">
              <div class="hero-cover">
                <img :src="anime.cover_url || PLACEHOLDER_URL" :alt="anime.title" @error="onImgError" />
              </div>
            </div>
            <div class="hero-info-col">
              <h1 class="hero-title">{{ anime.title }}</h1>
              <div class="hero-meta">
                <span v-if="anime.rating > 0" class="meta-rating">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><polygon points="6.5,0 8.5,4.5 13,5 10,8.5 11,12.5 6.5,10 2,12.5 3,8.5 0,5 4.5,4.5"/></svg>
                  {{ anime.rating }}
                </span>
                <span v-if="anime.year" class="meta-tag">{{ anime.year }}</span>
                <span v-if="anime.region" class="meta-tag">{{ anime.region }}</span>
                <span v-if="anime.status" class="meta-tag meta-tag--status">{{ anime.status }}</span>
              </div>
              <div v-if="anime.genres" class="hero-genres">
                <span v-for="g in (anime.genres || '').split(/[,，、]\s*/).filter(Boolean)" :key="g" class="genre-badge">{{ g }}</span>
              </div>
              <div v-if="anime.studio" class="hero-extra"><span class="ex-label">制作</span>{{ anime.studio }}</div>
              <div v-if="anime.original_title" class="hero-extra"><span class="ex-label">原名</span>{{ anime.original_title }}</div>
              <button class="collect-btn" :class="{ collected: isCollected }" @click="toggleCollection">
                <svg width="16" height="16" viewBox="0 0 16 16" :fill="isCollected ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5">
                  <polygon points="8,11 3,13 4,8 0,4.5 5,4 8,0 11,4 16,4.5 12,8 13,13"/>
                </svg>
                <span>{{ isCollected ? '已收藏' : '收藏' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="container">
        <!-- Description -->
        <div v-if="anime.description" class="detail-desc">
          <p>{{ anime.description }}</p>
        </div>

        <!-- Source Tabs -->
        <div class="source-tabs" v-if="allSources.length > 0">
          <span class="source-label">片源</span>
          <button v-for="(src, i) in allSources" :key="i" :class="['source-tab', { active: currentSourceIdx === src.index }]" @click="switchSource(src.index)">
            {{ src.name }}
          </button>
        </div>

        <!-- Episodes -->
        <div class="episode-section">
          <div class="episode-header">
            <h2 class="episode-title">剧集列表</h2>
            <button class="collapse-btn" @click="isCollapsed = !isCollapsed">
              {{ isCollapsed ? '展开全部 ▾' : '收起 ▴' }}
            </button>
          </div>
          <div v-if="activeEpisodes.length === 0 && !loading" class="no-episodes">暂无剧集信息</div>
          <div v-if="!isCollapsed && activeEpisodes.length" class="episode-grid">
            <button v-for="ep in activeEpisodes" :key="ep.id || ep.episode_number + (ep._yhdm ? 'y' : '')" class="episode-btn" @click="playEpisode(ep)">
              <span class="ep-num">{{ ep.episode_number }}</span>
              <span v-if="ep.title" class="ep-name">{{ ep.title }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-page { padding-bottom: 80px; }

/* Hero */
.detail-hero { position: relative; margin-bottom: 28px; min-height: 380px; overflow: hidden; }
.hero-bg-img { position: absolute; inset: 0; }
.hero-bg-img img { width: 100%; height: 100%; object-fit: cover; transform: scale(1.05); filter: brightness(0.6); }
.hero-bg-veil {
  position: absolute; inset: 0;
  background: linear-gradient(to top, var(--bg-abyss) 0%, transparent 55%),
              linear-gradient(to right, rgba(7,6,15,0.92) 0%, rgba(7,6,15,0.3) 55%, rgba(7,6,15,0.6) 100%);
}
.hero-body { position: relative; z-index: 2; padding-top: 12px; }

.back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  color: var(--text-secondary); padding: 6px 14px; border-radius: 20px;
  font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.25s ease;
  font-family: inherit; margin-bottom: 24px;
}
.back-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

.hero-layout { display: flex; gap: 32px; }
.hero-cover-col { flex-shrink: 0; }
.hero-cover {
  width: 220px; border-radius: var(--radius-lg); overflow: hidden;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
}
.hero-cover img { width: 100%; aspect-ratio: 2/3; object-fit: cover; display: block; }

.hero-info-col { flex: 1; display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
.hero-title { font-size: 30px; font-weight: 900; color: #fff; letter-spacing: -0.5px; line-height: 1.2; text-shadow: 0 2px 20px rgba(0,0,0,0.6); }
.hero-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.meta-rating {
  display: flex; align-items: center; gap: 4px;
  background: rgba(232, 197, 96, 0.12); color: var(--gold);
  padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 700;
}
.meta-tag {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  padding: 4px 12px; border-radius: 20px; font-size: 12px; color: var(--text-secondary);
}
.meta-tag--status {
  border-color: rgba(242, 132, 158, 0.3); color: var(--sakura-light); background: rgba(242, 132, 158, 0.08);
}

.hero-genres { display: flex; flex-wrap: wrap; gap: 6px; }
.genre-badge {
  padding: 4px 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px;
  font-size: 12px; color: var(--text-secondary); background: rgba(255,255,255,0.02);
  transition: all 0.2s; cursor: default;
}
.genre-badge:hover { border-color: var(--sakura); color: var(--sakura-light); background: rgba(242,132,158,0.05); }

.hero-extra { font-size: 13px; color: var(--text-secondary); }
.ex-label { color: var(--text-dim); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 8px; }

.collect-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-secondary); padding: 10px 22px; border-radius: 24px;
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.3s var(--ease-out);
  font-family: inherit; width: fit-content; margin-top: 4px;
}
.collect-btn:hover { border-color: var(--gold); color: var(--gold); background: rgba(232,197,96,0.05); transform: translateY(-1px); }
.collect-btn.collected { border-color: var(--gold); background: rgba(232,197,96,0.1); color: var(--gold); box-shadow: 0 0 20px var(--gold-glow); }

/* Description */
.detail-desc {
  margin-bottom: 32px; padding: 18px 22px;
  background: var(--bg-card); border: 1px solid var(--border-card);
  border-radius: var(--radius-lg); border-left: 3px solid var(--sakura);
  font-size: 14px; line-height: 1.8; color: var(--text-secondary);
}

/* Source tabs */
.source-tabs { display: flex; align-items: center; gap: 8px; margin-bottom: 28px; flex-wrap: wrap; }
.source-label { font-size: 12px; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px; }
.source-tab {
  background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 20px;
  color: var(--text-secondary); padding: 7px 18px; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.25s var(--ease-out); font-family: inherit;
}
.source-tab:hover { color: #fff; border-color: var(--border-glow); }
.source-tab.active {
  background: var(--pink-blue);
  border-color: transparent; color: #fff; font-weight: 700;
  box-shadow: 0 4px 18px var(--sakura-glow);
}

/* Episodes */
.episode-section { margin-bottom: 32px; }
.episode-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.episode-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.collapse-btn {
  background: transparent; border: 1px solid var(--border-subtle); color: var(--text-dim);
  padding: 5px 14px; border-radius: 20px; cursor: pointer; font-size: 11px; font-weight: 500;
  transition: all 0.2s; font-family: inherit;
}
.collapse-btn:hover { color: var(--sakura-light); border-color: var(--sakura); }
.no-episodes { color: var(--text-dim); text-align: center; padding: 40px; font-size: 14px; }

.episode-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; padding: 4px 0;
}
.episode-btn {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-sm);
  color: var(--text-secondary); padding: 12px 8px; cursor: pointer;
  transition: all 0.2s var(--ease-out); font-family: inherit;
}
.episode-btn:hover {
  background: var(--bg-card-hover); border-color: var(--sakura); color: #fff;
  transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}
.ep-num { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.ep-name { font-size: 11px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }

@media (max-width: 768px) {
  .detail-hero { min-height: 300px; }
  .hero-layout { flex-direction: column; align-items: center; gap: 18px; }
  .hero-cover { width: 150px; }
  .hero-title { font-size: 24px; text-align: center; }
  .hero-meta { justify-content: center; }
  .hero-genres { justify-content: center; }
  .hero-info-col { align-items: center; }
  .episode-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
}
</style>
