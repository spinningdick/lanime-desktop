<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getHomeData, getCoverUrl, api, PLACEHOLDER_URL, getCoverFallbackUrl } from '../api/index.js'

const router = useRouter()
const searchKey = ref('')
const latestUpdates = ref([])
const recommendations = ref([])
const loading = ref(true)

const banners = ref([])
const activeBanner = ref(0)
let bannerTimer = null

// 触摸滑动
let touchStartX = 0
let touchStartY = 0
let isSwiping = false

function onTouchStart(e) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  isSwiping = true
}

function onTouchMove(e) {
  if (!isSwiping) return
  const dx = Math.abs(e.touches[0].clientX - touchStartX)
  const dy = Math.abs(e.touches[0].clientY - touchStartY)
  // 水平滑动大于垂直滑动时阻止页面滚动
  if (dx > dy && dx > 10) {
    e.preventDefault()
  }
}

function onTouchEnd(e) {
  if (!isSwiping) return
  isSwiping = false
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  // 水平滑动超过40px且大于垂直滑动
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 0.6) {
    if (dx < 0) {
      activeBanner.value = (activeBanner.value + 1) % banners.value.length
    } else {
      activeBanner.value = (activeBanner.value - 1 + banners.value.length) % banners.value.length
    }
    resetTimer()
  }
}

function resetTimer() {
  clearInterval(bannerTimer)
  bannerTimer = setInterval(() => {
    if (banners.value.length > 1) {
      activeBanner.value = (activeBanner.value + 1) % banners.value.length
    }
  }, 5000)
}

onMounted(async () => {
  try {
    const [homeRes, rankRes] = await Promise.all([
      getHomeData(),
      api.get('/anime/ranking', { params: { type: 'weekly' } }),
    ])

    const homeData = (homeRes.data || []).map(item => ({
      ...item, cover_url: getCoverUrl(item),
    }))

    // 排行榜封面用高清 CDN（比缩略图清晰）
    const rankItems = (rankRes.data?.items || []).slice(0, 5).map(item => {
      const srcId = item.source_id || item.age_id
      return {
        ...item,
        cover_url: srcId ? `https://cdn.aqdstatic.com:966/age/${srcId}.jpg` : getCoverUrl(item),
      }
    })
    banners.value = rankItems

    latestUpdates.value = homeData.slice(0, 30)
    recommendations.value = homeData.slice(30, 50)
  } catch (e) {
    console.error('Failed to load homepage', e)
  } finally {
    loading.value = false
  }

  resetTimer()
})

onUnmounted(() => clearInterval(bannerTimer))

function goBanner(index) {
  activeBanner.value = index
  resetTimer()
}

function doSearch() {
  if (searchKey.value.trim()) {
    router.push({ name: 'Search', query: { q: searchKey.value } })
  }
}

function goRanking() {
  router.push('/ranking?type=weekly')
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
  <div class="home-page">
    <div v-if="loading" class="loading">加载中...</div>

    <template v-else>
      <!-- Hero Carousel — 全幅大图 -->
      <section v-if="banners.length" class="hero-carousel"
        @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd"
      >
        <div
          v-for="(item, i) in banners"
          :key="item.source_id || i"
          class="hero-slide"
          :class="{ active: i === activeBanner }"
          @click="goDetail(item)"
        >
          <div class="hero-bg">
            <img :src="item.cover_url || PLACEHOLDER_URL" :alt="item.title" @error="onImgError" />
            <div class="hero-veil"></div>
          </div>
          <div class="hero-content container">
            <div class="hero-eyebrow" @click.stop="goRanking">周榜 TOP{{ i + 1 }}</div>
            <h1 class="hero-title">{{ item.title }}</h1>
            <p v-if="item.genres" class="hero-genres">{{ item.genres }}</p>
            <button class="hero-cta" @click.stop="goDetail(item)">
              <span>立即观看</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><polygon points="4,1 14,8 4,15"/></svg>
            </button>
          </div>
        </div>
        <div class="hero-dots" v-if="banners.length > 1">
          <button
            v-for="(_, i) in banners"
            :key="i"
            :class="['hero-dot', { active: i === activeBanner }]"
            @click.stop="goBanner(i)"
          ></button>
        </div>
        <div class="hero-kanji">番</div>

        <!-- 搜索栏 — 镶嵌在封面右上角 -->
        <form class="hero-search" @submit.prevent="doSearch" @click.stop>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input v-model="searchKey" type="search" placeholder="搜索番剧..." />
        </form>
      </section>

      <div class="container">
        <h2 class="section-title">最新更新</h2>
        <div class="anime-grid">
          <div
            v-for="item in latestUpdates"
            :key="item.age_id || item.source_id || item.gogo_id || item.title"
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

        <template v-if="recommendations.length">
          <h2 class="section-title">为你推荐</h2>
          <div class="anime-grid">
            <div
              v-for="item in recommendations"
              :key="item.age_id || item.source_id || item.gogo_id || item.title"
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
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home-page { padding-bottom: 80px; }

/* 搜索栏 — 镶嵌在周榜封面右上角 */
.hero-search {
  position: absolute;
  top: 16px;
  right: 24px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 22px;
  padding: 7px 14px;
  width: 240px;
  transition: border-color 0.25s, background 0.25s, width 0.25s;
}

.hero-search:focus-within {
  border-color: rgba(240,107,138,0.4);
  background: rgba(0,0,0,0.6);
  width: 280px;
}

.hero-search svg {
  color: rgba(255,255,255,0.55);
  flex-shrink: 0;
}

.hero-search input {
  flex: 1;
  background: none;
  border: none;
  color: #fff;
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.hero-search input::placeholder {
  color: rgba(255,255,255,0.4);
}

/* ============ Carousel — full image hero ============ */
.hero-carousel {
  position: relative; height: 460px; overflow: hidden; margin-bottom: 4px;
  touch-action: pan-y; /* 允许垂直滚动，水平手势留给轮播 */
}
.hero-slide {
  position: absolute; inset: 0; opacity: 0; transition: opacity 0.8s ease;
  cursor: pointer; pointer-events: none;
}
.hero-slide.active { opacity: 1; pointer-events: auto; }
.hero-bg { position: absolute; inset: 0; }
.hero-bg img {
  width: 100%; height: 100%; object-fit: cover;
  transition: transform 8s ease;
}
.hero-slide.active .hero-bg img { transform: scale(1.05); }
.hero-veil {
  position: absolute; inset: 0;
  background:
    linear-gradient(to top, var(--bg-abyss) 0%, transparent 55%),
    linear-gradient(to right, rgba(7,6,15,0.85) 0%, transparent 55%),
    linear-gradient(45deg, rgba(74,140,247,0.08) 0%, transparent 40%);
}
.hero-content {
  position: relative; z-index: 2; height: 100%;
  display: flex; flex-direction: column; justify-content: flex-end;
  padding-bottom: 52px;
}
.hero-eyebrow {
  display: inline-block; width: fit-content;
  background: rgba(240,107,138,0.15); border: 1px solid rgba(240,107,138,0.3);
  color: var(--pink-light); padding: 5px 16px; border-radius: 20px;
  font-size: 13px; font-weight: 700; margin-bottom: 14px; letter-spacing: 0.5px;
  cursor: pointer; transition: all 0.25s;
}
.hero-eyebrow:hover {
  background: rgba(240,107,138,0.3); border-color: rgba(240,107,138,0.5);
  transform: translateY(-1px);
}
.hero-title {
  font-size: 40px; font-weight: 900; color: #fff;
  letter-spacing: -0.8px; line-height: 1.1; margin-bottom: 10px;
  max-width: 560px; text-shadow: 0 2px 30px rgba(0,0,0,0.7);
}
.hero-genres {
  font-size: 14px; color: rgba(255,255,255,0.55); margin-bottom: 24px; max-width: 440px;
}
.hero-cta {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--pink-blue); color: #fff; border: none;
  padding: 12px 30px; border-radius: 26px; font-size: 15px; font-weight: 700;
  cursor: pointer; width: fit-content;
  box-shadow: 0 4px 24px rgba(240,107,138,0.35);
  transition: all 0.3s; font-family: inherit;
}
.hero-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 36px rgba(240,107,138,0.5); }
.hero-kanji {
  position: absolute; right: -40px; bottom: -20px; font-size: 300px;
  font-weight: 900; color: rgba(255,255,255,0.012); pointer-events: none; user-select: none; z-index: 1;
}

/* Dots */
.hero-dots {
  position: absolute; bottom: 20px; right: 28px; z-index: 3;
  display: flex; gap: 10px;
}
.hero-dot {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.35); background: transparent;
  cursor: pointer; transition: all 0.3s; padding: 0;
}
.hero-dot.active { background: #fff; border-color: #fff; transform: scale(1.2); }

/* ============ Card ============ */
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
.card-img-wrap img {
  width: 100%; aspect-ratio: 2/3; object-fit: cover; display: block;
  background: rgba(0,0,0,0.2);
  transition: transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94);
}
.anime-card:hover .card-img-wrap img { transform: scale(1.06); }
.card-badge {
  position: absolute; bottom: 8px; left: 8px;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
  color: var(--pink-light); padding: 3px 10px; border-radius: 12px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.3px;
}
.card-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%);
  opacity: 0; transition: opacity 0.35s;
  display: flex; align-items: center; justify-content: center;
}
.anime-card:hover .card-overlay { opacity: 1; }
.card-title {
  padding: 10px 10px 12px; font-size: 13px; font-weight: 600;
  color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .hero-carousel { height: 340px; }
  .hero-title { font-size: 26px; }
  .hero-content { padding-bottom: 36px; }
  .hero-dots { right: 12px; bottom: 12px; }
}
</style>
