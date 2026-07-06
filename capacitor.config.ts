import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lanime.app',
  appName: 'Lanime',
  webDir: 'dist',
  server: {
    // 允许 Capacitor 加载本地资源
    cleartext: true,
    androidScheme: 'https',
    // iOS 允许任意网络请求（包括 HTTP）
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    // 允许访问视频流媒体
    allowsLinkPreview: false,
    // 状态栏样式
    preferredContentMode: 'mobile',
  },
};

export default config;
