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
      notificationTitle: 'MotoHub Delivery - GPS Ativo',
      notificationText: 'Rastreamento em tempo real para suas entregas.',
      notificationIconColor: '#4f46e5',
      enableHighAccuracy: true,
      backgroundMessage: 'GPS ativo para rastreamento de entregas',
      backgroundTitle: 'MotoHub Delivery',
      requestPermissions: true,
      stale: false,
      distanceFilter: 5
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#4f46e5"
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    // Configurações para melhor background processing
    backgroundColor: "#4f46e5",
    // Permissões necessárias para GPS e notificações em background
    permissions: [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION", 
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.WAKE_LOCK",
      "android.permission.RECEIVE_BOOT_COMPLETED"
    ]
  }
};

export default config;