import { reactive, computed } from 'vue'

const PROD_API = 'https://l-anime.pages.dev'

function apiBase() {
  if (typeof window === 'undefined') return ''
  if ((window.Capacitor && window.Capacitor.isNativePlatform()) ||
      (window.electron && window.electron.isElectron) ||
      window.location.protocol === 'file:') {
    return PROD_API
  }
  return ''
}

async function apiFetch(path, options = {}) {
  const resp = await fetch(apiBase() + path, options)
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || '请求失败')
  return data
}

const state = reactive({
  user: null,
  token: localStorage.getItem('lanime_token') || null,
  loading: false,
})

if (state.token) {
  fetchUser()
}

async function fetchUser() {
  try {
    state.user = await apiFetch('/api/auth/me', {
      headers: { Authorization: 'Bearer ' + state.token },
    })
  } catch {
    state.token = null
    localStorage.removeItem('lanime_token')
    state.user = null
  }
}

export function useAuth() {
  const isLoggedIn = computed(() => !!state.user)

  async function login(email, password) {
    state.loading = true
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      state.token = data.token
      state.user = data.user
      localStorage.setItem('lanime_token', data.token)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    } finally {
      state.loading = false
    }
  }

  async function register(email, password, nickname) {
    state.loading = true
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname }),
      })
      state.token = data.token
      state.user = data.user
      localStorage.setItem('lanime_token', data.token)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    } finally {
      state.loading = false
    }
  }

  async function updateAvatar(file) {
    // 前端压缩：缩到 256x256，JPEG 质量 0.7，体积小不影响显示
    const compressed = await compressImage(file, 256, 0.7)
    const dataUrl = compressed || await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    state.loading = true
    try {
      await apiFetch('/api/auth/avatar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + state.token,
        },
        body: JSON.stringify({ avatar: dataUrl }),
      })
      state.user.avatar = dataUrl
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    } finally {
      state.loading = false
    }
  }

  function compressImage(file, maxSize, quality) {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        if (width <= maxSize && height <= maxSize) {
          // 不需要缩放，但还是转 JPEG 压缩
        }
        if (width > height) {
          height = Math.round(height * maxSize / width)
          width = maxSize
        } else {
          width = Math.round(width * maxSize / height)
          height = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null) // 压缩失败走原始流程
      }
      img.src = url
    })
  }

  function logout() {
    state.token = null
    state.user = null
    localStorage.removeItem('lanime_token')
  }

  return { state, isLoggedIn, login, register, logout, updateAvatar }
}
