<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getHistory, api, PLACEHOLDER_URL } from '../api/index.js'

const router = useRouter()
const historyList = ref([])
const loading = ref(true)
const selectMode = ref(false)
const selectedIds = ref(new Set())

onMounted(async () => {
  await loadHistory()
})

async function loadHistory() {
  loading.value = true
  try {
    const { data } = await getHistory()
    historyList.value = data || []
    selectedIds.value = new Set()
    selectMode.value = false
  } catch (e) {
    console.error('Failed to load history', e)
  } finally {
    loading.value = false
  }
}

function enterSelectMode() {
  selectMode.value = true
  selectedIds.value = new Set()
}

function exitSelectMode() {
  selectMode.value = false
  selectedIds.value = new Set()
}

function onItemClick(item) {
  if (selectMode.value) {
    const s = new Set(selectedIds.value)
    if (s.has(item.id)) s.delete(item.id)
    else s.add(item.id)
    selectedIds.value = s
  } else {
    goPlay(item)
  }
}

function selectAll() {
  selectedIds.value = new Set(historyList.value.map(item => item.id))
}

async function deleteSelected() {
  if (!selectedIds.value.size) return
  for (const id of selectedIds.value) {
    try { await api.delete(`/history/${id}`) } catch {}
  }
  await loadHistory()
}

async function clearAll() {
  try { await api.post('/history/clear') } catch {}
  await loadHistory()
}

function goPlay(item) {
  const id = item.age_id || item.gogo_id || item.anime_id
  const prefix = item.age_id ? 'age' : (item.gogo_id ? 'gogo' : '')
  if (prefix === 'age') router.push('/play/' + prefix + '/' + id + '/1/' + (item.episode_number || 1))
  else if (prefix === 'gogo') router.push('/play/' + prefix + '/' + id + '/' + (item.episode_number || 1))
  else router.push('/play/' + id + '/1/' + (item.episode_number || 1))
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="container page-history">
    <div class="history-header">
      <h2 class="section-title">观看历史</h2>
      <div v-if="historyList.length" class="history-actions">
        <template v-if="selectMode">
          <button class="act-btn" @click="selectAll">全选</button>
          <button
            class="act-btn act-del"
            :disabled="!selectedIds.size"
            @click="deleteSelected"
          >删除 ({{ selectedIds.size }})</button>
          <button class="act-btn" @click="clearAll">清空全部</button>
          <button class="act-btn act-cancel" @click="exitSelectMode">取消</button>
        </template>
        <button v-else class="act-btn act-select" @click="enterSelectMode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <span>选择</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="historyList.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <circle cx="24" cy="24" r="22"/>
        <polyline points="24,14 24,24 32,28"/>
      </svg>
      <p>还没有观看记录</p>
      <span class="empty-hint">开始看番吧！</span>
    </div>
    <div v-else class="history-list">
      <div
        v-for="item in historyList"
        :key="item.id"
        class="history-item"
        :class="{ 'select-mode': selectMode, 'is-selected': selectMode && selectedIds.has(item.id) }"
        @click="onItemClick(item)"
      >
        <div class="h-cover">
          <img :src="item.cover_url || PLACEHOLDER_URL" :alt="item.anime_title" />
          <div class="h-cover-play">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="white"><polygon points="6,3 16,9 6,15"/></svg>
          </div>
        </div>
        <div class="h-info">
          <div class="h-title">{{ item.anime_title }}</div>
          <div class="h-ep">{{ item.episode_title }}</div>
          <div class="h-meta">
            <span v-if="item.progress > 0" class="h-progress">已看 {{ Math.round(item.progress * 100) }}%</span>
            <span class="h-time">{{ timeAgo(item.updated_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-history { padding-top: 20px; padding-bottom: 60px; }

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.history-header .section-title { margin: 0; }

.history-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.act-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 15px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: #b0adc2;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.act-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #fff; }

.act-select {
  border-color: rgba(74,140,247,0.25);
  color: #4a8cf7;
}
.act-select:hover {
  border-color: rgba(74,140,247,0.5);
  background: rgba(74,140,247,0.08);
}

.act-del:hover:not(:disabled) { border-color: rgba(240,107,138,0.4); color: #f06b8a; background: rgba(240,107,138,0.06); }
.act-cancel { color: #6b6880; }
.act-cancel:hover { color: #fff; }

/* ===== 列表 ===== */
.history-list { display: flex; flex-direction: column; gap: 8px; }

.history-item {
  display: flex; align-items: center; gap: 14px;
  background: var(--bg-card); border: 1px solid var(--border-card);
  border-radius: var(--radius-lg); padding: 12px 16px;
  transition: all 0.25s ease;
  cursor: pointer;
}

.history-item:hover { background: var(--bg-card-hover); border-color: var(--border-glow); transform: translateX(4px); }

.history-item.select-mode {
  cursor: pointer;
}

.history-item.is-selected {
  background: rgba(74,140,247,0.12);
  border-color: rgba(74,140,247,0.4);
  box-shadow: 0 0 20px rgba(74,140,247,0.08);
}

.history-item.is-selected:hover {
  background: rgba(74,140,247,0.16);
  border-color: rgba(74,140,247,0.55);
}

.h-cover {
  position: relative; flex-shrink: 0;
  width: 64px; height: 90px; border-radius: var(--radius-sm); overflow: hidden;
}
.h-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
.history-item:hover .h-cover img { transform: scale(1.1); }
.h-cover-play {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.5); opacity: 0; transition: opacity 0.3s;
}
.history-item:hover .h-cover-play { opacity: 1; }
/* 选择模式下不显示播放图标 */
.history-item.select-mode:hover .h-cover-play { opacity: 0; }
.history-item.select-mode:hover .h-cover img { transform: none; }

.h-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.h-title { font-size: 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.h-ep { font-size: 12px; color: var(--sakura-light); font-weight: 500; }
.h-meta { display: flex; align-items: center; gap: 8px; }
.h-progress { background: rgba(242, 132, 158, 0.1); color: var(--sakura-light); padding: 1px 8px; border-radius: 8px; font-size: 10px; font-weight: 600; }
.h-time { font-size: 11px; color: var(--text-dim); }

.empty-hint { font-size: 13px; color: var(--text-dim); margin-top: 6px; }
</style>
