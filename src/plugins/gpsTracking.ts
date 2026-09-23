import { registerPlugin } from '@capacitor/core';

export interface GpsTrackingPlugin {
  /**
   * Inicia o foreground service de rastreamento GPS
   * Mantém GPS ativo mesmo com app minimizado ou usando outro app
   */
  startTracking(): Promise<{ success: boolean; message: string }>;
  
  /**
   * Para o foreground service de rastreamento GPS
   */
  stopTracking(): Promise<{ success: boolean; message: string }>;
  
  /**
   * Verifica se o rastreamento está ativo
   */
  isTracking(): Promise<{ isTracking: boolean }>;
  
  /**
   * Adiciona listener para atualizações de localização
   */
  addListener(
    eventName: 'locationUpdate',
    listenerFunc: (location: GpsLocation) => void
  ): Promise<any>;
}

export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number; // km/h
  bearing: number; // graus (0-360)
  timestamp: number; // milissegundos
}

const GpsTracking = registerPlugin<GpsTrackingPlugin>('GpsTracking', {
  web: () => import('./gpsTrackingWeb').then(m => new m.GpsTrackingWeb()),
});

export default GpsTracking;
