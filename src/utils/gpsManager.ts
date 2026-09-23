"use client";

import { Capacitor } from '@capacitor/core';
import { gpsTracker as webGpsTracker, GpsState } from './gpsTracker';
import { gpsTrackerNative, GpsState as NativeGpsState } from './gpsTrackerNative';

/**
 * Gerenciador inteligente de GPS que escolhe automaticamente:
 * - Foreground Service Nativo no Android/iOS (mantém GPS ativo mesmo com app minimizado)
 * - GPS Web otimizado no navegador desktop/PWA
 */
class GpsManager {
  private useNative: boolean;
  
  constructor() {
    // Usar GPS nativo se estiver em plataforma Android/iOS
    this.useNative = Capacitor.isNativePlatform();
    
    console.log(this.useNative 
      ? '🏍️ GPS Manager: Usando Foreground Service Nativo (Android/iOS)'
      : '🌐 GPS Manager: Usando GPS Web (PWA/Desktop)'
    );
  }
  
  /**
   * Inicia rastreamento GPS
   * Android/iOS: Inicia foreground service com notificação persistente
   * Web: Inicia GPS com wake lock e web worker
   */
  public async startTracking() {
    if (this.useNative) {
      await gpsTrackerNative.startTracking();
    } else {
      webGpsTracker.startTracking();
    }
  }
  
  /**
   * Para rastreamento GPS
   */
  public async stopTracking() {
    if (this.useNative) {
      await gpsTrackerNative.stopTracking();
    } else {
      await webGpsTracker.stopTracking();
    }
  }
  
  /**
   * Adiciona listener para atualizações de estado do GPS
   */
  public subscribe(callback: (state: GpsState | NativeGpsState) => void) {
    if (this.useNative) {
      return gpsTrackerNative.subscribe(callback);
    } else {
      return webGpsTracker.subscribe(callback);
    }
  }
  
  /**
   * Define se está navegando
   */
  public setNavigating(navigating: boolean) {
    if (this.useNative) {
      gpsTrackerNative.setNavigating(navigating);
    } else {
      webGpsTracker.setNavigating(navigating);
    }
  }
  
  /**
   * Obtém estado atual do GPS
   */
  public getState(): GpsState | NativeGpsState {
    if (this.useNative) {
      return gpsTrackerNative.getState();
    } else {
      return webGpsTracker['currentState']; // Acesso via subscript para currentState privado
    }
  }
  
  /**
   * Verifica se está rastreando
   */
  public async isTrackingActive(): Promise<boolean> {
    if (this.useNative) {
      return await gpsTrackerNative.isTrackingActive();
    } else {
      // Web GPS sempre está "ativo" quando watchId existe
      return webGpsTracker['watchId'] !== null;
    }
  }
  
  /**
   * Solicita permissão manualmente
   */
  public requestManualPermission() {
    if (!this.useNative) {
      webGpsTracker.requestManualPermission();
    } else {
      // No nativo, startTracking já solicita permissão
      this.startTracking();
    }
  }
}

export const gpsManager = new GpsManager();
export type { GpsState };
