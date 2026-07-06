<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getCoverUrl, PLACEHOLDER_URL, getCoverFallbackUrl } from '../api/index.js'

const router = useRouter()
const tags = ref([])
const selected = ref([])
const results = ref([])
const loading = ref(false)
const hasMore = ref(false)

const PROD_API = 'https://l-anime.pages.dev'
const isNative = typeof window !== 'undefined' && (
  (window.Capacitor && window.Capacitor.isNativePlatform()) ||
  (window.electron && window.electron.isElectron) ||
  window.location.protocol === 'file:'
)
const apiBase = isNative ? PROD_API : ''

async function fetchTags() {
  try {
    const resp = await fetch(apiBase + '/api/tags')
    if (resp.ok) tags.value = await resp.json()
  } catch {}
}

async function fetchResults() {
  if (!selected.value.length) { results.value = []; return }
  loading.value = true
  try {
    const resp = await fetch(apiBase + '/api/anime/by-tags?tags=' + encodeURIComponent(selected.value.join(',')))
    if (resp.ok) {
      const data = await resp.json()
      results.value = (data.items || []).map(item => ({
        ...item,
        cover_url: getCoverUrl(item),
      }))
      hasMore.value = data.hasMore || false
    }
  } catch {} finally {
    loading.value = false
  }
}

function toggleTag(tag) {
  const idx = selected.value.indexOf(tag)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else {
    selected.value.push(tag)
  }
  fetchResults()
}

function goDetail(item) {
  if (item.id && item.id !== 0) router.push('/detail/' + item.id)
  else if (item.age_id) router.push('/detail/age/' + item.age_id)
  else if (item.yhdm_id) router.push('/detail/yhdm/' + item.yhdm_id)
  else if (item.fcm_id) router.push('/detail/fcm/' + item.fcm_id)
  else if (item.source_id) {
    // 来自源站搜索的 item，根据 source 路由
    if (item.source === 'agedm') router.push('/detail/age/' + item.source_id)
    else if (item.source === 'yhdm') router.push('/detail/yhdm/' + item.source_id)
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

onMounted(fetchTags)
</script>

<template>
  <div class="category-page">
    <div class="container">
      <h2 class="section-title">分类筛选</h2>

      <!-- 标签选择 -->
      <div class="tag-grid">
        <button
          v-for="tag in tags"
          :key="tag"
          :class="['tag-btn', { active: selected.includes(tag) }]"
          @click="toggleTag(tag)"
        >{{ tag }}</button>
      </div>

      <p v-if="selected.length" class="filter-hint">
        已选 {{ selected.length }} 个标签 —
        <template v-for="(t, i) in selected" :key="t">{{ i > 0 ? ' + ' : '' }}{{ t }}</template>
        — {{ results.length }} 个结果
      </p>

      <!-- 结果 -->
      <div v-if="loading" class="loading">加载中...</div>

      <template v-else-if="selected.length && results.length === 0 && !loading">
        <div class="empty-state">
          <p>没有同时包含「<strong>{{ selected.join('、') }}</strong>」的动漫</p>
          <span class="empty-hint">换个标签组合试试吧</span>
        </div>
      </template>

      <template v-else-if="selected.length === 0">
        <div class="empty-state">
          <p>选择标签来筛选动漫</p>
        </div>
      </template>

      <div v-else class="anime-grid">
        <div
          v-for="item in results"
          :key="item.age_id || item.source_id || item.title"
          class="anime-card"
          @click="goDetail(item)"
        >
          <div class="card-img-wrap">
            <img :src="item.cover_url || PLACEHOLDER_URL" :alt="item.title" loading="lazy" @error="onImgError" />
            <div v-if="item.status_text" class="card-badge">{{ item.status_text }}</div>
            <div class="card-overlay">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="8,4 20,12 8,20"/></svg>
            </div>
          </div>
          <div class="card-title">{{ item.title }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-page {
  padding-bottom: 80px;
}

.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.tag-btn {
  padding: 8px 16px;
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #b0adc2;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.tag-btn:hover {
  background: rgba(240,107,138,0.1);
  border-color: rgba(240,107,138,0.2);
  color: #f06b8a;
}

.tag-btn.active {
  background: rgba(240,107,138,0.2);
  border-color: rgba(240,107,138,0.4);
  color: #fff;
  font-weight: 600;
}

.filter-hint {
  font-size: 13px;
  color: #6b6880;
  margin-bottom: 16px;
}

/* 复用动画卡片的样式 */
.anime-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.anime-card {
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.12);
  transition: transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.45s ease, border-color 0.45s ease;
  cursor: pointer;
}

.anime-card:hover {
  transform: translateY(-10px);
  border-color: rgba(240,107,138,0.3);
  box-shadow: 0 20px 40px -12px rgba(0,0,0,0.5), 0 0 60px -10px rgba(240,107,138,0.12);
}

.card-img-wrap { position: relative; overflow: hidden; }
.card-img-wrap img {
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
  display: block;
  background: rgba(0,0,0,0.2);
  transition: transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94);
}
.anime-card:hover .card-img-wrap img { transform: scale(1.06); }

.card-badge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
  color: #f06b8a;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%);
  opacity: 0;
  transition: opacity 0.35s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.anime-card:hover .card-overlay { opacity: 1; }

.card-title {
  padding: 10px 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #edeaf5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #6b6880;
  font-size: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #6b6880;
  gap: 12px;
}

.empty-state p { font-size: 15px; }
.empty-hint { font-size: 13px; opacity: 0.5; }
</style>
