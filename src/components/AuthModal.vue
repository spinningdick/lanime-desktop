<script setup>
import { ref } from 'vue'
import { useAuth } from '../stores/auth.js'

const emit = defineEmits(['close'])

const { login, register, state } = useAuth()

const isLogin = ref(true)
const email = ref('')
const password = ref('')
const nickname = ref('')
const error = ref('')
const showPwd = ref(false)

async function submit() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = '请填写邮箱和密码'
    return
  }
  if (password.value.length < 6) {
    error.value = '密码至少6位'
    return
  }

  let result
  if (isLogin.value) {
    result = await login(email.value, password.value)
  } else {
    result = await register(email.value, password.value, nickname.value || email.value.split('@')[0])
  }

  if (result.success) {
    emit('close')
  } else {
    error.value = result.error
  }
}

function toggle() {
  isLogin.value = !isLogin.value
  error.value = ''
}
</script>

<template>
  <div class="auth-overlay" @click.self="emit('close')">
    <div class="auth-card">
      <button class="auth-close" @click="emit('close')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div class="auth-header">
        <img src="/cat-logo.png" alt="" class="auth-cat" width="64" height="64" />
        <h2>{{ isLogin ? '登录 Lanime' : '注册 Lanime' }}</h2>
        <p class="auth-sub">{{ isLogin ? '同步收藏和历史记录' : '创建账号以同步你的数据' }}</p>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label>邮箱</label>
          <input v-model="email" type="email" placeholder="your@email.com" autocomplete="email" />
        </div>

        <div class="field">
          <label>密码</label>
          <div class="pwd-wrap">
            <input v-model="password" :type="showPwd ? 'text' : 'password'" placeholder="至少6位" autocomplete="current-password" />
            <button type="button" class="pwd-eye" @click="showPwd = !showPwd" :title="showPwd ? '隐藏' : '显示'">
              <svg v-if="!showPwd" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>

        <div v-if="!isLogin" class="field">
          <label>昵称 <span class="opt">(选填)</span></label>
          <input v-model="nickname" type="text" placeholder="你的昵称" />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button type="submit" class="auth-btn" :disabled="state.loading">
          {{ state.loading ? '请稍候...' : (isLogin ? '登录' : '注册') }}
        </button>
      </form>

      <p class="auth-toggle">
        {{ isLogin ? '还没有账号？' : '已有账号？' }}
        <a href="#" @click.prevent="toggle">{{ isLogin ? '去注册' : '去登录' }}</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.auth-card {
  position: relative;
  background: #121122;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 40px 32px 28px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.auth-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: #6b6880;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.auth-close:hover { color: #fff; background: rgba(255,255,255,0.06); }

.auth-header {
  text-align: center;
  margin-bottom: 28px;
}

.auth-cat {
  display: block;
  margin: 0 auto 8px;
  border-radius: 16px;
}

.auth-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: #edeaf5;
  margin-bottom: 4px;
}

.auth-sub {
  font-size: 13px;
  color: #6b6880;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #b0adc2;
  margin-bottom: 6px;
}

.opt { color: #6b6880; font-weight: 400; }

.field input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus {
  border-color: rgba(240,107,138,0.35);
}

.pwd-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.pwd-wrap input {
  padding-right: 40px;
}

.pwd-eye {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6b6880;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.pwd-eye svg {
  transition: transform 0.25s ease;
}

.pwd-eye:active svg {
  transform: scale(0.85);
}

.pwd-eye:hover {
  color: #b0adc2;
}

.auth-error {
  color: #f06b8a;
  font-size: 13px;
  text-align: center;
}

.auth-btn {
  padding: 11px;
  background: linear-gradient(135deg, #4a8cf7, #f06b8a);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.2s;
}

.auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.auth-btn:hover:not(:disabled) { opacity: 0.9; }

.auth-toggle {
  text-align: center;
  margin-top: 20px;
  font-size: 13px;
  color: #6b6880;
}

.auth-toggle a {
  color: #f06b8a;
  text-decoration: none;
  font-weight: 500;
}

.auth-toggle a:hover { text-decoration: underline; }
</style>
