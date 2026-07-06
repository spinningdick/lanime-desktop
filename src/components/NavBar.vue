<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import AuthModal from './AuthModal.vue'

defineProps({ isElectron: Boolean })

const router = useRouter()
const route = useRoute()
const { state: authState, isLoggedIn, logout, updateAvatar } = useAuth()

const collapsed = ref(false)
const showAuth = ref(false)
const avatarInput = ref(null)

const userInitial = computed(() => {
  if (!authState.user) return ''
  const name = authState.user.nickname || authState.user.email || ''
  return name.charAt(0).toUpperCase()
})

function isActive(name) {
  return route.name === name
}

function triggerAvatar() {
  if (!isLoggedIn.value) return showAuth.value = true
  avatarInput.value?.click()
}

async function onAvatarChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 200 * 1024) {
    alert('图片太大了，请选择 200KB 以内的图片')
    return
  }
  const result = await updateAvatar(file)
  if (!result.success) alert(result.error)
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <!-- 折叠按钮 — 右上角 -->
    <button class="collapse-btn" @click="collapsed = !collapsed" :title="collapsed ? '展开' : '收起'">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" :style="{ transform: collapsed ? 'rotate(180deg)' : '' }">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>

    <!-- 用户区 -->
    <div class="sidebar-user" @click="triggerAvatar">
      <template v-if="isLoggedIn">
        <div class="user-avatar" v-if="!authState.user.avatar" :title="collapsed ? '点击更换头像' : ''">{{ userInitial }}</div>
        <img v-else class="user-avatar-img" :src="authState.user.avatar" :title="collapsed ? '点击更换头像' : ''" />
        <div v-if="!collapsed" class="user-info">
          <div class="user-name">{{ authState.user.nickname || authState.user.email }}</div>
          <button class="user-logout" @click.stop="logout">退出</button>
        </div>
      </template>
      <template v-else>
        <div class="user-avatar guest">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <button v-if="!collapsed" class="auth-btn-side" @click.stop="showAuth = true">登录 / 注册</button>
      </template>
    </div>

    <!-- 隐藏的文件选择 -->
    <input ref="avatarInput" type="file" accept="image/*" style="display:none" @change="onAvatarChange" />

    <!-- 导航链接 -->
    <nav class="sidebar-nav">
      <router-link to="/" class="side-link" :class="{ active: isActive('Home') }" :title="collapsed ? '首页' : ''">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span v-if="!collapsed">首页</span>
      </router-link>

      <router-link to="/ranking" class="side-link" :class="{ active: isActive('Ranking') }" :title="collapsed ? '排行榜' : ''">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        <span v-if="!collapsed">排行榜</span>
      </router-link>

      <router-link to="/collections" class="side-link" :class="{ active: isActive('Collections') }" :title="collapsed ? '收藏' : ''">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span v-if="!collapsed">收藏</span>
      </router-link>

      <router-link to="/history" class="side-link" :class="{ active: isActive('History') }" :title="collapsed ? '历史' : ''">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span v-if="!collapsed">历史</span>
      </router-link>

      <router-link to="/category" class="side-link" :class="{ active: isActive('Category') }" :title="collapsed ? '分类' : ''">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span v-if="!collapsed">分类</span>
      </router-link>
    </nav>
  </aside>

  <!-- 登录弹窗 -->
  <AuthModal v-if="showAuth" @close="showAuth = false" />
</template>

<style scoped>
.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 200px;
  min-width: 200px;
  height: 100%;
  background: var(--bg-surface, #121122);
  border-right: 1px solid rgba(255,255,255,0.06);
  transition: width 0.25s ease, min-width 0.25s ease;
  overflow: visible;
}

.sidebar.collapsed {
  width: 60px;
  min-width: 60px;
}

/* ===== 折叠按钮 — 右边中间 ===== */
.collapse-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: 8px;
  background: var(--bg-surface, #121122);
  border: 1px solid rgba(255,255,255,0.08);
  color: #6b6880;
  cursor: pointer;
  padding: 7px 4px;
  border-radius: 6px;
  transition: all 0.2s;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.collapsed .collapse-btn {
  right: 50%;
  transform: translate(50%, -50%);
}

.collapsed .collapse-btn:hover {
  background: #1a1a30;
}

.collapse-btn:hover {
  color: #fff;
  background: #1a1a30;
  border-color: rgba(255,255,255,0.15);
}

.collapse-btn svg {
  transition: transform 0.25s ease;
}

/* ===== 用户区 ===== */
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  margin-bottom: 4px;
  cursor: pointer;
}

.collapsed .sidebar-user {
  justify-content: center;
  padding: 20px 8px 16px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a8cf7, #f06b8a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.user-avatar:hover { opacity: 0.8; }

.user-avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.user-avatar-img:hover { opacity: 0.8; }

.user-avatar.guest {
  background: rgba(255,255,255,0.08);
  color: #6b6880;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #edeaf5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-logout {
  background: none;
  border: none;
  color: #6b6880;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
}

.user-logout:hover { color: #f06b8a; }

.auth-btn-side {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: #b0adc2;
  font-size: 12px;
  cursor: pointer;
  padding: 6px 10px;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.2s;
}

.auth-btn-side:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}

/* ===== 导航链接 ===== */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
  flex: 1;
}

.side-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--text-muted, #6b6880);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
}

.collapsed .side-link {
  justify-content: center;
  padding: 10px;
}

.side-link:hover {
  color: #fff;
  background: rgba(255,255,255,0.04);
}

.side-link.active {
  color: #fff;
  background: rgba(255,255,255,0.06);
  font-weight: 700;
}

.side-link.active svg {
  color: #f06b8a;
}

</style>
