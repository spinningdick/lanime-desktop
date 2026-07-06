import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Search from '../views/Search.vue'
import Detail from '../views/Detail.vue'
import Play from '../views/Play.vue'
import Collections from '../views/Collections.vue'
import History from '../views/History.vue'
import Ranking from '../views/Ranking.vue'
import Category from '../views/Category.vue'

// 检测是否在 Capacitor 原生 / Electron / file:// 环境运行
function isNativePlatform() {
  if (typeof window === 'undefined') return false
  if (window.Capacitor && window.Capacitor.isNativePlatform()) return true
  if (window.electron && window.electron.isElectron) return true
  if (window.location.protocol === 'file:') return true
  return false
}
const isNative = isNativePlatform()

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/search', name: 'Search', component: Search },
  { path: '/detail/:id', name: 'Detail', component: Detail },
  { path: '/detail/age/:ageId', name: 'DetailAge', component: Detail },
  { path: '/detail/yhdm/:yhdmId', name: 'DetailYhdm', component: Detail },
  { path: '/detail/fcm/:fcmId', name: 'DetailFcm', component: Detail },
  { path: '/play/age/:ageId/:sourceIdx/:epNum', name: 'Play', component: Play },
  { path: '/play/yhdm/:yhdmId/:epNum', name: 'PlayYhdm', component: Play },
  { path: '/play/fcm/:fcmId/:epNum', name: 'PlayFcm', component: Play },
  { path: '/play/:sourceId/:episodeId', name: 'PlayLegacy', component: Play },
  { path: '/collections', name: 'Collections', component: Collections },
  { path: '/ranking', name: 'Ranking', component: Ranking },
  { path: '/history', name: 'History', component: History },
  { path: '/category', name: 'Category', component: Category },
]

const router = createRouter({
  // Capacitor 用 file:// 协议加载，不支持 HTML5 History 模式，必须用 hash
  history: isNative ? createWebHashHistory() : createWebHistory(),
  routes,
})

export default router
