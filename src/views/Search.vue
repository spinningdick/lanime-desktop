<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchAnime, getCoverUrl, PLACEHOLDER_URL, getCoverFallbackUrl } from '../api/index.js'

const route = useRoute()
const router = useRouter()
const keyword = ref('')
const results = ref([])
const loading = ref(false)

const error = ref(false)

watch(() => route.query.q, (val) => {
  if (val) { keyword.value = val; doSearch() }
}, { immediate: true })

async function doSearch() {
  if (!keyword.value.trim()) return
  loading.value = true
  error.value = false
  try {
    const { data } = await searchAnime(keyword.value)
    results.value = (data.items || []).map(item => ({
      ...item,
      cover_url: getCoverUrl(item),
    }))
  } catch (e) {
    console.error('Search failed', e)
    error.value = true
  } finally {
    loading.value = false
  }
}

function goDetail(item) {
  if (item.id && item.id !== 0) router.push('/detail/' + item.id)
  else if (item.age_id) router.push('/detail/age/' + item.age_id)
  else if (item.yhdm_id) router.push('/detail/yhdm/' + item.yhdm_id)
  else if (item.fcm_id) router.push('/detail/fcm/' + item.fcm_id)
  else if (item.source_id) {
    if (item.source === 'yhdm') router.push('/detail/yhdm/' + item.source_id)
    else if (item.source === 'fengchedm') router.push('/detail/fcm/' + item.source_id)
    else router.push('/detail/age/' + item.source_id)
  }
}
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
  <div class="container search-page">
    <div class="search-header">
      <h2 class="section-title">"{{ route.query.q }}" 的搜索结果</h2>
      <span v-if="!loading && results.length" class="result-count">{{ results.length }} 个结果</span>
    </div>

    <div v-if="loading" class="loading">搜索中...</div>

    <div v-else-if="error" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><circle cx="24" cy="24" r="20"/><path d="M24 16v12M24 32h0" stroke-width="2"/></svg>
      <p>搜索失败，请重试</p>
      <span class="empty-hint">源站可能暂时不可用</span>
    </div>

    <div v-else-if="results.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <circle cx="22" cy="22" r="16"/><path d="m34 34-8-8"/>
        <path d="M22 14v4M18 18h8" stroke-width="2"/>
      </svg>
      <p>未找到相关内容</p>
      <span class="empty-hint">试试其他关键词</span>
    </div>

    <div v-else class="anime-grid">
      <div v-for="item in results" :key="item.id || item.age_id || item.gogo_id" class="anime-card" @click="goDetail(item)">
        <div class="card-img-wrap">
          <img :src="item.cover_url || PLACEHOLDER_URL" :alt="item.title" loading="lazy" @error="onImgError" />
          <div v-if="item.source" class="card-source">{{ { agedm:'AGE', yhdm:'樱花' }[item.source] || item.source }}</div>
          <div class="card-overlay">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="white"><polygon points="9,5 21,13 9,21"/></svg>
          </div>
        </div>
        <div class="card-title">{{ item.title }}</div>
        <div v-if="item.genres" class="card-genre">{{ item.genres.slice(0, 20) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page { padding-top: 20px; padding-bottom: 60px; }
.search-header { display: flex; align-items: baseline; gap: 12px; }
.result-count { font-size: 13px; color: var(--text-muted); }

.anime-card {
  border-radius: 14px; overflow: hidden;
  background: rgba(255,255,255,0.06); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.12);
  transition: transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.45s cubic-bezier(0.25,0.46,0.45,0.94), border-color 0.45s ease, background 0.45s ease;
  cursor: pointer;
}
.anime-card:hover {
  transform: translateY(-10px);
  background: rgba(255,255,255,0.12); border-color: rgba(240,107,138,0.3);
  box-shadow: 0 20px 40px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1), 0 0 60px -10px rgba(240,107,138,0.12);
  z-index: 2;
}
.card-img-wrap { position: relative; overflow: hidden; }
.card-img-wrap img { width: 100%; aspect-ratio: 2/3; object-fit: cover; display: block; background: rgba(0,0,0,0.2); transition: transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94); }
.anime-card:hover .card-img-wrap img { transform: scale(1.06); }
.card-source {
  position: absolute; top: 8px; right: 8px;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
  color: var(--pink-light); padding: 2px 8px; border-radius: 10px;
  font-size: 10px; font-weight: 700;
}
.card-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%);
  opacity: 0; transition: opacity 0.35s;
  display: flex; align-items: center; justify-content: center;
}
.anime-card:hover .card-overlay { opacity: 1; }
.card-title { padding: 10px 10px 4px; font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-genre { padding: 0 10px 10px; font-size: 11px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty-hint { font-size: 13px; color: var(--text-dim); margin-top: 6px; }
</style>
