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
    // 读文件转 base64 data URL
    const dataUrl = await new Promise((resolve, reject) => {
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

  function logout() {
    state.token = null
    state.user = null
    localStorage.removeItem('lanime_token')
  }

  return { state, isLoggedIn, login, register, logout, updateAvatar }
}
