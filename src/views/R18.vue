<script setup>
import { ref, onMounted, computed } from 'vue'
import { r18Categories, r18Latest, r18Search, r18Detail, r18VideoProxyUrl } from '../api/index.js'

const categories = ref([])
const activeGenre = ref('里番')
const videos = ref([])
const loading = ref(true)

const keyword = ref('')
const searchResults = ref([])
const isSearching = ref(false)

const selectedVideo = ref(null)
const selectedSource = ref(null)

onMounted(async () => {
  try {
    const { data } = await r18Categories()
    categories.value = data.categories || []
  } catch {}
  await loadVideos()
})

async function loadVideos(page = 1) {
  loading.value = true
  videos.value = []
  try {
    const { data } = await r18Latest(activeGenre.value, page)
    videos.value = data.items || []
  } catch { videos.value = [] }
  finally { loading.value = false }
}

function switchGenre(genre) {
  if (activeGenre.value === genre) return
  activeGenre.value = genre
  keyword.value = ''
  searchResults.value = []
  isSearching.value = false
  loadVideos()
}

async function doSearch() {
  if (!keyword.value.trim()) return
  isSearching.value = true
  loading.value = true
  try {
    const { data } = await r18Search(keyword.value)
    searchResults.value = data.items || []
  } catch { searchResults.value = [] }
  finally { loading.value = false }
}

async function openVideo(v) {
  selectedVideo.value = null
  selectedSource.value = null
  try {
    const { data } = await r18Detail(v.video_id)
    if (data?.sources?.length) selectedSource.value = data.sources[0]
    selectedVideo.value = data
  } catch {}
}

function closeVideo() {
  selectedVideo.value = null
  selectedSource.value = null
}

function goHome() {
  isSearching.value = false
  keyword.value = ''
  searchResults.value = []
  loadVideos()
}

const displayVideos = computed(() => isSearching.value ? searchResults.value : videos.value)
</script>

<template>
  <div class="r18-page">
    <div v-if="selectedVideo" class="video-overlay" @click.self="closeVideo">
      <div class="video-modal">
        <button class="close-btn" @click="closeVideo">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5l10 10M15 5L5 15"/></svg>
        </button>
        <div class="video-player-wrap">
          <video v-if="selectedSource"
            :src="r18VideoProxyUrl(selectedSource.url)"
            class="r18-player" controls autoplay
          ></video>
        </div>
        <div class="video-info-bar">
          <h2>{{ selectedVideo.title }}</h2>
          <div class="source-pills">
            <button
              v-for="(s, i) in selectedVideo.sources"
              :key="i"
              :class="['source-pill', { active: selectedSource?.url === s.url }]"
              @click="selectedSource = s"
            >{{ s.quality }}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="r18-header">
        <h2 class="section-title">R18 分区</h2>
        <button class="back-btn" @click="goHome" v-if="isSearching">← 返回分类</button>
      </div>

      <div class="genre-tabs" v-if="categories.length && !isSearching">
        <button
          v-for="g in categories"
          :key="g.id"
          :class="['genre-tab', { active: activeGenre === g.id }]"
          @click="switchGenre(g.id)"
        >{{ g.label }}</button>
      </div>

      <form class="r18-search" @submit.prevent="doSearch">
        <input v-model="keyword" type="search" placeholder="搜索 R18 视频..." />
        <button type="submit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
      </form>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="displayVideos.length === 0" class="empty-state">无相关内容</div>
      <div v-else class="r18-grid">
        <div v-for="v in displayVideos" :key="v.video_id" class="r18-card" @click="openVideo(v)">
          <div class="r18-cover-wrap">
            <img v-if="v.cover_url" :src="v.cover_url" :alt="v.title" loading="lazy" />
            <div v-else class="r18-no-cover">R18</div>
            <div class="r18-duration" v-if="v.duration">{{ v.duration }}</div>
            <div class="r18-play-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="white"><polygon points="9,5 22,14 9,23"/></svg>
            </div>
          </div>
          <div class="r18-title">{{ v.title }}</div>
          <div class="r18-views" v-if="v.views">{{ v.views }}次</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.r18-page { padding-top: 20px; padding-bottom: 80px; min-height: 100vh; }
.r18-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
.r18-header .section-title { margin-bottom: 0; }

.back-btn {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-secondary); padding: 4px 12px; border-radius: 16px;
  font-size: 12px; cursor: pointer; transition: 0.2s; font-family: inherit;
}
.back-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }

.genre-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 12px 0 16px; }
.genre-tab {
  background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 18px;
  color: var(--text-secondary); padding: 6px 16px; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.2s; font-family: inherit;
}
.genre-tab:hover { color: #fff; border-color: var(--sakura); }
.genre-tab.active {
  background: var(--pink-blue);
  border-color: transparent; color: #fff; font-weight: 600;
}

.r18-search { display: flex; gap: 0; margin-bottom: 20px; max-width: 360px; }
.r18-search input {
  flex: 1; background: var(--bg-card); border: 1px solid var(--border-card);
  border-radius: 20px 0 0 20px; padding: 8px 16px; color: #fff;
  outline: none; font-size: 13px; font-family: inherit;
}
.r18-search input:focus { border-color: rgba(242,132,158,0.3); }
.r18-search button {
  background: var(--sakura); border: none; border-radius: 0 20px 20px 0;
  padding: 8px 14px; color: #fff; cursor: pointer; display: flex; align-items: center;
  transition: 0.2s;
}
.r18-search button:hover { background: var(--indigo); }

.r18-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.r18-card {
  background: var(--bg-card); border: 1px solid var(--border-card);
  border-radius: var(--radius-md); overflow: hidden; cursor: pointer;
  transition: all 0.3s var(--ease-out);
}
.r18-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px var(--border-glow);
}
.r18-cover-wrap {
  position: relative; aspect-ratio: 16/10; background: var(--bg-surface); overflow: hidden;
}
.r18-cover-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.r18-card:hover .r18-cover-wrap img { transform: scale(1.06); }
.r18-no-cover {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  color: var(--text-dim); font-weight: 700; font-size: 20px;
}
.r18-duration {
  position: absolute; bottom: 6px; right: 6px;
  background: rgba(0,0,0,0.7); color: #fff;
  padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;
}
.r18-play-icon {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4); opacity: 0; transition: opacity 0.3s;
}
.r18-card:hover .r18-play-icon { opacity: 1; }
.r18-title {
  padding: 8px 10px 4px; font-size: 13px; font-weight: 600;
  color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.r18-views { padding: 0 10px 8px; font-size: 11px; color: var(--text-dim); }

.video-overlay {
  position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.9);
  display: flex; align-items: center; justify-content: center;
}
.video-modal { width: min(900px, 95vw); max-height: 90vh; display: flex; flex-direction: column; }
.close-btn {
  align-self: flex-end; background: none; border: none; color: #fff;
  cursor: pointer; padding: 8px; transition: 0.2s;
}
.close-btn:hover { opacity: 0.7; }
.video-player-wrap { background: #000; border-radius: 8px; overflow: hidden; }
.r18-player { width: 100%; display: block; max-height: 70vh; }
.video-info-bar {
  padding: 14px 0; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
}
.video-info-bar h2 { font-size: 16px; font-weight: 700; color: #fff; flex: 1; }
.source-pills { display: flex; gap: 6px; flex-wrap: wrap; }
.source-pill {
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 16px; color: var(--text-secondary); padding: 4px 12px;
  font-size: 11px; font-weight: 600; cursor: pointer; transition: 0.2s; font-family: inherit;
}
.source-pill:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
.source-pill.active { background: var(--sakura); border-color: var(--sakura); color: #fff; }

@media (max-width: 768px) {
  .r18-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .video-info-bar { flex-direction: column; align-items: flex-start; }
}
</style>
