import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.motohub.delivery',
  appName: 'MotoHub Delivery',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    BackgroundGeolocation: {
      notificationTitle: 'MotoHub Delivery',
      notificationText: 'Rastreamento GPS ativo em segundo plano.',
      notificationIconColor: '#4f46e5'
    }
  }
};

export default config;