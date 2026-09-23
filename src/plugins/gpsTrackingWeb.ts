import { WebPlugin } from '@capacitor/core';
import type { GpsTrackingPlugin, GpsLocation } from './gpsTracking';

export class GpsTrackingWeb extends WebPlugin implements GpsTrackingPlugin {
  private watchId: number | null = null;
  
  async startTracking(): Promise<{ success: boolean; message: string }> {
    console.log('GPS Tracking: Web fallback - usando navigator.geolocation');
    
    if (!navigator.geolocation) {
      return { success: false, message: 'Geolocation not supported' };
    }
    
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: GpsLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: (position.coords.speed || 0) * 3.6, // m/s para km/h
          bearing: position.coords.heading || 0,
          timestamp: position.timestamp
        };
        
        this.notifyListeners('locationUpdate', location);
      },
      (error) => {
        console.error('GPS Error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
    
    return { success: true, message: 'GPS tracking started (web fallback)' };
  }
  
  async stopTracking(): Promise<{ success: boolean; message: string }> {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    return { success: true, message: 'GPS tracking stopped' };
  }
  
  async isTracking(): Promise<{ isTracking: boolean }> {
    return { isTracking: this.watchId !== null };
  }
}
