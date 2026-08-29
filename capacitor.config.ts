import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.motohub.delivery',
  appName: 'MotoHub Delivery',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'https://rqieirvzutdculcdsncb.supabase.co/*',
      'https://*.googleapis.com/*',
      'https://*.openstreetmap.org/*',
      'https://*.cartocdn.com/*'
    ]
  },
  plugins: {
    BackgroundGeolocation: {
      notificationTitle: 'MotoHub Delivery',
      notificationText: 'Rastreamento GPS ativo em tempo real.',
      notificationIconColor: '#4f46e5'
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;