import { supabase } from './supabase';
import { db } from './db';

export interface LocationPayload {
  riderId: string;
  riderName: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  timestamp: number;
}

export interface OfflinePayload {
  riderId: string;
  timestamp: number;
}

type LocationCallback = (payload: LocationPayload) => void;
type OfflineCallback = (payload: OfflinePayload) => void;

class RealtimeGpsManager {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private listeners: Set<LocationCallback> = new Set();
  private offlineListeners: Set<OfflineCallback> = new Set();
  private isSubscribed = false;

  public init() {
    if (this.channel) return;

    this.channel = supabase.channel('motoboy-live-tracking', {
      config: {
        broadcast: { self: false }
      }
    });

    this.channel
      .on('broadcast', { event: 'location-update' }, (response) => {
        const payload = response.payload as LocationPayload;
        if (payload && payload.riderId && payload.lat && payload.lng) {
          db.updateRiderLocation(payload.riderId, payload.riderName, payload.lat, payload.lng);
          this.listeners.forEach((listener) => listener(payload));
        }
      })
      .on('broadcast', { event: 'rider-offline' }, (response) => {
        const payload = response.payload as OfflinePayload;
        if (payload && payload.riderId) {
          // Remove localmente do DB mock
          const locations = db.getRiderLocationsRecord();
          if (locations[payload.riderId]) {
            delete locations[payload.riderId];
            localStorage.setItem('delivery_system_rider_locations', JSON.stringify(locations));
          }
          // Notifica ouvintes (mapas)
          this.offlineListeners.forEach((listener) => listener(payload));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
        }
      });
  }

  public sendLocation(payload: LocationPayload) {
    if (!this.channel) this.init();

    if (this.channel && this.isSubscribed) {
      this.channel.send({
        type: 'broadcast',
        event: 'location-update',
        payload
      }).catch(() => {});
    }

    db.updateRiderLocation(payload.riderId, payload.riderName, payload.lat, payload.lng);
  }

  public sendOffline(riderId: string) {
    if (!this.channel) this.init();

    const payload: OfflinePayload = { riderId, timestamp: Date.now() };

    if (this.channel && this.isSubscribed) {
      this.channel.send({
        type: 'broadcast',
        event: 'rider-offline',
        payload
      }).catch(() => {});
    }
  }

  public subscribeToLocations(callback: LocationCallback) {
    this.listeners.add(callback);
    if (!this.channel) this.init();
    return () => {
      this.listeners.delete(callback);
    };
  }

  public subscribeToOffline(callback: OfflineCallback) {
    this.offlineListeners.add(callback);
    if (!this.channel) this.init();
    return () => {
      this.offlineListeners.delete(callback);
    };
  }
}

export const realtimeGps = new RealtimeGpsManager();
realtimeGps.init();