<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, PLACEHOLDER_URL, getCoverFallbackUrl } from '../api/index.js'

const router = useRouter()
const route = useRoute()

const tabs = [
  { key: 'weekly', label: '周榜' },
  { key: 'monthly', label: '月榜' },
  { key: 'alltime', label: '总榜' },
]

const activeTab = ref('weekly')
const items = ref([])
const loading = ref(true)
const lastUpdate = ref('')

watch(activeTab, (val) => {
  router.replace({ query: { type: val } })
  fetchRanking(val)
})

onMounted(() => {
  const type = route.query.type || 'weekly'
  if (tabs.some(t => t.key === type)) activeTab.value = type
  fetchRanking(activeTab.value)
})

async function fetchRanking(type) {
  loading.value = true
  try {
    const { data } = await api.get('/anime/ranking', { params: { type } })
    items.value = (data.items || []).map(item => ({
      ...item,
      cover_url: getCoverUrl(item),
    }))
    lastUpdate.value = data.updated_at || ''
  } catch (e) {
    items.value = []
  } finally {
    loading.value = false
  }
}

function getCoverUrl(item) {
  if (!item?.cover_url) return ''
  if (item.cover_url.startsWith('http')) return item.cover_url
  if (item.cover_url.startsWith('//')) return 'https:' + item.cover_url
  return item.cover_url
}

function goDetail(item) {
  if (item.age_id || item.source_id) router.push('/detail/age/' + (item.age_id || item.source_id))
  else if (item.id) router.push('/detail/' + item.id)
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
function formatTime(ts) { return ts ? new Date(ts).toLocaleDateString('zh-CN') : '' }
</script>

<template>
  <div class="container ranking-page">
    <header class="ranking-hero">
      <h2 class="ranking-title">排行榜</h2>
      <p class="ranking-sub">全站热门动漫排名</p>

      <div class="rank-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['rank-tab', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >{{ tab.label }}</button>
      </div>

      <span v-if="lastUpdate" class="update-time">更新于 {{ formatTime(lastUpdate) }}</span>
    </header>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="items.length === 0" class="empty-state">暂无排行数据</div>

    <div v-else class="rank-list">
      <div
        v-for="(item, index) in items"
        :key="item.source_id || index"
        class="rank-item"
        :class="{
          'rank--1': index === 0,
          'rank--2': index === 1,
          'rank--3': index === 2,
        }"
        @click="goDetail(item)"
      >
        <!-- Rank number — custom styled -->
        <div class="rank-num-col">
          <template v-if="index === 0">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="url(#goldGrad)" stroke="#e8c560" stroke-width="1"/>
              <text x="14" y="19" text-anchor="middle" fill="#0c0b18" font-size="13" font-weight="900">1</text>
              <defs><radialGradient id="goldGrad"><stop stop-color="#ffe9a0"/><stop offset="1" stop-color="#e8c560"/></radialGradient></defs>
            </svg>
          </template>
          <template v-else-if="index === 1">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="12" fill="url(#silverGrad)" stroke="#b0b8c8" stroke-width="1"/>
              <text x="13" y="18" text-anchor="middle" fill="#0c0b18" font-size="12" font-weight="900">2</text>
              <defs><radialGradient id="silverGrad"><stop stop-color="#e8ecf2"/><stop offset="1" stop-color="#b0b8c8"/></radialGradient></defs>
            </svg>
          </template>
          <template v-else-if="index === 2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="url(#bronzeGrad)" stroke="#c8946e" stroke-width="1"/>
              <text x="12" y="17" text-anchor="middle" fill="#0c0b18" font-size="11" font-weight="900">3</text>
              <defs><radialGradient id="bronzeGrad"><stop stop-color="#e8c8a8"/><stop offset="1" stop-color="#c8946e"/></radialGradient></defs>
            </svg>
          </template>
          <template v-else>
            <span class="rank-num">{{ index + 1 }}</span>
          </template>
        </div>

        <!-- Cover -->
        <div class="rank-cover">
          <img :src="item.cover_url || PLACEHOLDER_URL" :alt="item.title" loading="lazy" @error="onImgError" />
        </div>

        <!-- Info -->
        <div class="rank-info">
          <div class="rank-name">{{ item.title }}</div>
          <div class="rank-meta">
            <span v-if="item.genres" class="rank-genre">{{ item.genres.slice(0, 20) }}</span>
            <span v-if="item.views" class="rank-views">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M5.5 1C2.5 1 0 5.5 0 5.5s2.5 4.5 5.5 4.5S11 5.5 11 5.5 8.5 1 5.5 1zm0 7.5a3 3 0 110-6 3 3 0 010 6zm0-5a2 2 0 100 4 2 2 0 000-4z"/></svg>
              {{ item.views }}
            </span>
          </div>
        </div>

        <!-- Arrow -->
        <svg class="rank-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4l4 4-4 4"/></svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ranking-page { padding-top: 24px; padding-bottom: 80px; }

.ranking-hero { text-align: center; margin-bottom: 36px; }
.ranking-title {
  font-size: 32px; font-weight: 900; color: #fff; letter-spacing: -0.5px; margin-bottom: 4px;
}
.ranking-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; letter-spacing: 1px; }

/* Tabs */
.rank-tabs {
  display: inline-flex; gap: 0;
  background: var(--bg-card); border: 1px solid var(--border-card);
  border-radius: 22px; overflow: hidden;
}
.rank-tab {
  font-size: 13px; font-weight: 700; padding: 8px 26px;
  border: none; cursor: pointer;
  background: transparent; color: var(--text-muted);
  transition: all 0.3s; font-family: inherit;
}
.rank-tab:hover { color: var(--text-primary); }
.rank-tab.active {
  background: var(--pink-blue);
  color: #fff;
}
.update-time { display: block; font-size: 11px; color: var(--text-dim); margin-top: 14px; }

/* List */
.rank-list { display: flex; flex-direction: column; gap: 6px; max-width: 800px; margin: 0 auto; }

.rank-item {
  display: flex; align-items: center; gap: 16px;
  background: var(--bg-card); border: 1px solid var(--border-card);
  border-radius: var(--radius-lg); padding: 12px 20px;
  cursor: pointer; transition: all 0.3s var(--ease-out);
}
.rank-item:hover {
  background: var(--bg-card-hover); border-color: var(--border-glow);
  transform: translateX(6px);
}
.rank--1 { border-color: rgba(232, 197, 96, 0.25); background: linear-gradient(135deg, rgba(232, 197, 96, 0.08), var(--bg-card)); }
.rank--2 { border-color: rgba(176, 184, 200, 0.2); background: linear-gradient(135deg, rgba(176, 184, 200, 0.05), var(--bg-card)); }
.rank--3 { border-color: rgba(200, 148, 110, 0.2); background: linear-gradient(135deg, rgba(200, 148, 110, 0.05), var(--bg-card)); }

/* Rank number */
.rank-num-col { width: 36px; display: flex; justify-content: center; flex-shrink: 0; }
.rank-num { font-size: 18px; font-weight: 800; color: var(--text-dim); }

/* Cover */
.rank-cover {
  flex-shrink: 0; width: 56px; height: 78px;
  border-radius: var(--radius-sm); overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}
.rank-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
.rank-item:hover .rank-cover img { transform: scale(1.1); }

/* Info */
.rank-info { flex: 1; min-width: 0; }
.rank-name { font-size: 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.rank-meta { display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--text-muted); }
.rank-views { display: flex; align-items: center; gap: 3px; color: var(--sakura); font-weight: 600; }
.rank-arrow { color: var(--text-dim); flex-shrink: 0; transition: all 0.3s ease; }
.rank-item:hover .rank-arrow { color: var(--sakura); transform: translateX(3px); }

@media (max-width: 768px) {
  .ranking-title { font-size: 26px; }
  .rank-tab { padding: 7px 16px; font-size: 12px; }
  .rank-item { padding: 10px 14px; gap: 12px; }
}
</style>
