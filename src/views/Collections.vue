<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCoverUrl, PLACEHOLDER_URL } from '../api/index.js'

const router = useRouter()
const collections = ref([])
const loading = ref(true)

onMounted(() => {
  try {
    const raw = localStorage.getItem('lanime-collections')
    collections.value = raw ? JSON.parse(raw) : []
  } catch { collections.value = [] }
  finally { loading.value = false }
})

function goDetail(item) {
  if (item.age_id) router.push('/detail/age/' + item.age_id)
  else if (item.gogo_id) router.push('/detail/gogo/' + item.gogo_id)
}
function getCover(item) { return item.cover_url || getCoverUrl(item) || PLACEHOLDER_URL }
</script>

<template>
  <div class="container page-collections">
    <h2 class="section-title">我的收藏</h2>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="collections.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <polygon points="24,34 12,38 16,28 7,20 17,18 24,8 31,18 41,20 32,28 36,38"/>
      </svg>
      <p>还没有收藏的番剧</p>
      <span class="empty-hint">在详情页点击收藏即可添加</span>
    </div>
    <div v-else class="anime-grid">
      <div v-for="item in collections" :key="item.key" class="anime-card" @click="goDetail(item)">
        <div class="card-img-wrap">
          <img :src="getCover(item)" :alt="item.title" loading="lazy" />
          <div class="card-overlay">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="white"><polygon points="9,5 21,13 9,21"/></svg>
          </div>
        </div>
        <div class="card-title">{{ item.title }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-collections { padding-top: 20px; padding-bottom: 60px; }

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
.card-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%);
  opacity: 0; transition: opacity 0.35s;
  display: flex; align-items: center; justify-content: center;
}
.anime-card:hover .card-overlay { opacity: 1; }
.card-title { padding: 10px 10px 12px; font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty-hint { font-size: 13px; color: var(--text-dim); margin-top: 6px; }
</style>
