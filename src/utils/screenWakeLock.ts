"use client";

import { Capacitor } from '@capacitor/core';

// Importação condicional do plugin nativo
let KeepAwakeNative: any = null;
if (Capacitor.isNativePlatform()) {
  try {
    // @ts-ignore
    KeepAwakeNative = (window as any).KeepAwake;
  } catch (e) {
    console.warn('Plugin KeepAwake nativo não disponível');
  }
}

/**
 * Gerenciador de Screen Wake Lock
 * Mantém a tela sempre ligada quando o app está em uso
 * Essencial para apps de navegação e rastreamento GPS
 */
class ScreenWakeLockManager {
  private isAwakeEnabled: boolean = false;
  private webWakeLock: any = null;

  /**
   * Ativa o wake lock - tela não vai descansar
   */
  public async enableWakeLock() {
    if (this.isAwakeEnabled) {
      console.log('⚡ Screen wake lock já está ativo');
      return;
    }

    try {
      if (Capacitor.isNativePlatform() && KeepAwakeNative) {
        // Android/iOS: Usar plugin nativo se disponível
        await KeepAwakeNative.keepAwake();
        this.isAwakeEnabled = true;
        console.log('⚡ Screen wake lock ATIVADO (nativo)');
      } else {
        // Web ou fallback: Usar Wake Lock API do navegador
        if ('wakeLock' in navigator) {
          this.webWakeLock = await (navigator as any).wakeLock.request('screen');
          this.isAwakeEnabled = true;
          console.log('⚡ Screen wake lock ATIVADO (web)');
          
          // Listener para reativar se perder o lock
          this.webWakeLock.addEventListener('release', () => {
            console.log('⚠️ Wake lock foi liberado, tentando reativar...');
            if (this.isAwakeEnabled) {
              setTimeout(() => this.enableWakeLock(), 1000);
            }
          });
        } else {
          console.warn('⚠️ Wake Lock API não disponível');
          // Fallback: Manter elemento vídeo invisível tocando
          this.enableVideoFallback();
        }
      }
    } catch (error) {
      console.error('❌ Erro ao ativar wake lock:', error);
      // Tentar fallback
      this.enableVideoFallback();
    }
  }

  /**
   * Fallback usando vídeo invisível (para browsers antigos)
   */
  private enableVideoFallback() {
    if (typeof document === 'undefined') return;
    
    const existingVideo = document.getElementById('wake-lock-video');
    if (existingVideo) return;
    
    const video = document.createElement('video');
    video.id = 'wake-lock-video';
    video.setAttribute('loop', 'true');
    video.setAttribute('muted', 'true');
    video.setAttribute('playsinline', 'true');
    video.style.position = 'fixed';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.width = '1px';
    video.style.height = '1px';
    
    // Vídeo vazio de 1 frame
    video.src = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAAAA';
    
    document.body.appendChild(video);
    video.play().catch(() => {});
    
    this.isAwakeEnabled = true;
    console.log('⚡ Screen wake lock ATIVADO (fallback video)');
  }

  /**
   * Desativa o wake lock - tela volta ao comportamento normal
   */
  public async disableWakeLock() {
    if (!this.isAwakeEnabled) {
      console.log('⚡ Screen wake lock já está desativado');
      return;
    }

    try {
      if (Capacitor.isNativePlatform() && KeepAwakeNative) {
        // Android/iOS: Desativar plugin nativo
        await KeepAwakeNative.allowSleep();
        this.isAwakeEnabled = false;
        console.log('⚡ Screen wake lock DESATIVADO (nativo)');
      } else {
        // Web: Liberar wake lock do navegador
        if (this.webWakeLock) {
          await this.webWakeLock.release();
          this.webWakeLock = null;
          this.isAwakeEnabled = false;
          console.log('⚡ Screen wake lock DESATIVADO (web)');
        }
        
        // Remover vídeo fallback se existir
        const video = document.getElementById('wake-lock-video');
        if (video) {
          video.remove();
        }
      }
    } catch (error) {
      console.error('❌ Erro ao desativar wake lock:', error);
    }
    
    this.isAwakeEnabled = false;
  }

  /**
   * Verifica se wake lock está ativo
   */
  public isActive(): boolean {
    return this.isAwakeEnabled;
  }

  /**
   * Reativa wake lock se tela foi bloqueada/desbloqueada
   * Útil para manter ativo após device wake
   */
  public async reactivateIfNeeded() {
    if (this.isAwakeEnabled) {
      // Desativa e reativa para garantir
      await this.disableWakeLock();
      await this.enableWakeLock();
      console.log('🔄 Wake lock reativado');
    }
  }
}

export const screenWakeLock = new ScreenWakeLockManager();
