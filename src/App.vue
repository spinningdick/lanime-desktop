<script setup>
import { RouterView } from 'vue-router'
import NavBar from './components/NavBar.vue'

const isElectron = typeof window !== 'undefined' && window.electron && window.electron.isElectron

function doMinimize() { window.electron?.minimize() }
function doMaximize() { window.electron?.maximize() }
function doClose() { window.electron?.close() }
</script>

<template>
  <div class="app" :class="{ electron: isElectron }">
    <!-- 自定义标题栏（仅 Electron） -->
    <header v-if="isElectron" class="titlebar">
      <div class="titlebar-drag">
        <img class="titlebar-cat" src="/cat-logo.png" alt="" width="20" height="20" />
        <span class="titlebar-logo">Lanime</span>
      </div>
      <div class="titlebar-actions">
        <button class="tb-btn tb-min" @click="doMinimize" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1.5" fill="currentColor"/></svg>
        </button>
        <button class="tb-btn tb-max" @click="doMaximize" title="最大化">
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="tb-btn tb-close" @click="doClose" title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="1.5"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
    </header>

    <div class="app-body">
      <!-- 侧边导航 -->
      <NavBar :isElectron="isElectron" />

      <!-- 主内容区 -->
      <main class="main-content">
        <RouterView v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <keep-alive :max="10">
              <component :is="Component" :key="$route.fullPath" />
            </keep-alive>
          </transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style>
body {
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* ===== 标题栏 ===== */
.titlebar {
  display: flex;
  align-items: center;
  height: 44px;
  background: var(--bg-titlebar);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.titlebar-drag {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  padding-left: 18px;
  gap: 10px;
}

.titlebar-cat {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  flex-shrink: 0;
}

.titlebar-logo {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: -0.3px;
  line-height: 1;
  background: var(--pink-blue);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  user-select: none;
}

.titlebar-actions {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.tb-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.tb-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
.tb-close:hover { background: #e81123; color: #fff; }

/* ===== 主布局 ===== */
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 0;
}

.main-content::-webkit-scrollbar {
  width: 6px;
}
.main-content::-webkit-scrollbar-track {
  background: transparent;
}
.main-content::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
}

/* ===== 页面过渡 ===== */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ===== 通用 ===== */
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 24px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.anime-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--text-muted);
  font-size: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: var(--text-muted);
  gap: 12px;
}
.empty-state p { font-size: 15px; }
.empty-hint { font-size: 13px; opacity: 0.5; }

@media (max-width: 768px) {
  .anime-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
  .container { padding: 12px; }
}
</style>
