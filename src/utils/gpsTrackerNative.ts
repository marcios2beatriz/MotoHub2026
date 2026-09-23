"use client";

import { Capacitor } from '@capacitor/core';
import GpsTracking, { GpsLocation as NativeGpsLocation } from '../plugins/gpsTracking';
import { db } from './db';
import { realtimeGps } from './realtimeGps';

// Detectar se está em plataforma nativa Android/iOS
const isNativePlatform = Capacitor.isNativePlatform();

export interface GpsLocation {
  lat: number;
  lng: number;
  accuracy: number;
  speedKmh: number;
  heading: number;
  timestamp: number;
}

export type GpsSignalQuality = 'excellent' | 'good' | 'weak' | 'lost' | 'denied' | 'off';

export interface GpsState {
  currentLocation: GpsLocation | null;
  quality: GpsSignalQuality;
  errorMessage: string | null;
  isNavigating: boolean;
}

/**
 * GPS Tracker com suporte a Foreground Service nativo Android
 * Mantém GPS ativo mesmo com app minimizado ou usando Waze/Google Maps
 */
class NativeGpsTracker {
  private lastLocation: GpsLocation | null = null;
  private listeners: Set<(state: GpsState) => void> = new Set();
  private isTracking: boolean = false;
  
  // Throttle para evitar excesso de gravações no banco
  private lastDbWriteTs: number = 0;
  private readonly DB_WRITE_INTERVAL_MS = 12000; // 12 segundos
  
  private currentState: GpsState = {
    currentLocation: null,
    quality: 'off',
    errorMessage: null,
    isNavigating: false
  };

  constructor() {
    this.setupLocationListener();
  }

  /**
   * Configura listener para atualizações de localização do foreground service
   */
  private setupLocationListener() {
    if (!isNativePlatform) return;

    GpsTracking.addListener('locationUpdate', (location: NativeGpsLocation) => {
      this.handleLocationUpdate(location);
    });
  }

  /**
   * Processa atualização de localização recebida do foreground service
   */
  private handleLocationUpdate(location: NativeGpsLocation) {
    const now = Date.now();
    
    const newLocation: GpsLocation = {
      lat: location.latitude,
      lng: location.longitude,
      accuracy: Math.round(location.accuracy),
      speedKmh: Math.round(location.speed), // Já vem em km/h do service
      heading: Math.round(location.bearing),
      timestamp: location.timestamp
    };

    this.lastLocation = newLocation;

    // Determinar qualidade do sinal GPS baseado na precisão
    let quality: GpsSignalQuality = 'excellent';
    if (location.accuracy > 80) {
      quality = 'weak';
    } else if (location.accuracy > 25) {
      quality = 'good';
    }

    this.currentState = {
      ...this.currentState,
      currentLocation: newLocation,
      quality,
      errorMessage: null
    };

    // Enviar para Supabase com throttling (otimização de custos)
    const currentUser = db.getCurrentUser();
    if (currentUser && currentUser.role === 'rider') {
      const timeSinceLastWrite = now - this.lastDbWriteTs;
      
      // Calcular distância movida desde última gravação
      let distanceMoved = 0;
      const prevLoc = this.getLocationFromDb(currentUser.id);
      if (prevLoc) {
        distanceMoved = this.calculateDistance(
          prevLoc.lat, prevLoc.lng,
          newLocation.lat, newLocation.lng
        );
      }
      
      // Só gravar se moveu significativamente OU passou tempo suficiente
      const shouldWrite = timeSinceLastWrite >= this.DB_WRITE_INTERVAL_MS || distanceMoved > 15;
      
      if (shouldWrite) {
        this.lastDbWriteTs = now;
        
        // Atualizar local e enviar para realtime
        db.updateRiderLocation(currentUser.id, currentUser.name, newLocation.lat, newLocation.lng);
        realtimeGps.sendLocation({
          riderId: currentUser.id,
          riderName: currentUser.name,
          lat: newLocation.lat,
          lng: newLocation.lng,
          speedKmh: newLocation.speedKmh,
          heading: newLocation.heading,
          timestamp: now
        });
        
        if (distanceMoved > 0) {
          console.log(`📍 GPS Native: ${distanceMoved.toFixed(1)}m moved, ${(timeSinceLastWrite/1000).toFixed(0)}s elapsed`);
        }
      }
    }

    this.notify();
  }

  /**
   * Obtém última localização do motoboy do DB local
   */
  private getLocationFromDb(riderId: string): { lat: number; lng: number } | null {
    const locations = db.getRiderLocationsRecord();
    return locations[riderId] || null;
  }

  /**
   * Calcula distância entre dois pontos em metros
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Raio da Terra em metros
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Adiciona listener para mudanças de estado do GPS
   */
  public subscribe(callback: (state: GpsState) => void) {
    this.listeners.add(callback);
    callback(this.currentState);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notifica todos os listeners sobre mudança de estado
   */
  private notify() {
    this.listeners.forEach((listener) => listener(this.currentState));
  }

  /**
   * Define se está navegando (afeta UI e comportamento)
   */
  public setNavigating(navigating: boolean) {
    this.currentState.isNavigating = navigating;
    this.notify();
  }

  /**
   * Inicia rastreamento GPS com foreground service nativo
   * No Android: cria notificação persistente e mantém GPS ativo mesmo em background
   */
  public async startTracking() {
    if (!isNativePlatform) {
      console.warn('GPS Nativo só funciona em plataforma Android/iOS');
      this.currentState = {
        ...this.currentState,
        quality: 'off',
        errorMessage: 'GPS nativo não disponível nesta plataforma'
      };
      this.notify();
      return;
    }

    try {
      const result = await GpsTracking.startTracking();
      
      if (result.success) {
        this.isTracking = true;
        this.currentState = {
          ...this.currentState,
          quality: 'good',
          errorMessage: null
        };
        this.notify();
        
        console.log('✅ GPS Foreground Service iniciado:', result.message);
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao iniciar GPS nativo:', error);
      
      this.currentState = {
        ...this.currentState,
        quality: 'denied',
        errorMessage: 'Erro ao iniciar GPS: ' + (error.message || 'Permissão negada')
      };
      this.notify();
    }
  }

  /**
   * Para rastreamento GPS e remove foreground service
   */
  public async stopTracking() {
    if (!isNativePlatform) return;

    try {
      const result = await GpsTracking.stopTracking();
      
      this.isTracking = false;
      this.lastLocation = null;
      this.currentState = {
        currentLocation: null,
        quality: 'off',
        errorMessage: null,
        isNavigating: false
      };
      this.notify();
      
      console.log('🛑 GPS Foreground Service parado:', result.message);
      
    } catch (error: any) {
      console.error('❌ Erro ao parar GPS nativo:', error);
    }
  }

  /**
   * Verifica se está rastreando
   */
  public async isTrackingActive(): Promise<boolean> {
    if (!isNativePlatform) return false;
    
    try {
      const result = await GpsTracking.isTracking();
      return result.isTracking;
    } catch {
      return false;
    }
  }

  /**
   * Obtém localização atual (última conhecida)
   */
  public getCurrentLocation(): GpsLocation | null {
    return this.lastLocation;
  }

  /**
   * Obtém estado atual do GPS
   */
  public getState(): GpsState {
    return this.currentState;
  }
}

export const gpsTrackerNative = new NativeGpsTracker();
