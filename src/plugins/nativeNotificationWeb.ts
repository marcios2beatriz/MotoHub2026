import { WebPlugin } from '@capacitor/core';
import type { NativeNotificationPlugin } from './nativeNotification';

/**
 * Implementação web/fallback do plugin de notificações nativas
 * Usa Notification API do navegador quando não está em plataforma nativa
 */
export class NativeNotificationWeb extends WebPlugin implements NativeNotificationPlugin {
  
  async sendChatNotification(options: {
    title: string;
    message: string;
    fromUserName: string;
  }): Promise<{ success: boolean }> {
    return this.sendWebNotification(options.title, options.message);
  }
  
  async sendScheduleNotification(options: {
    title: string;
    message: string;
  }): Promise<{ success: boolean }> {
    return this.sendWebNotification(options.title, options.message);
  }
  
  async sendGeneralNotification(options: {
    title: string;
    message: string;
  }): Promise<{ success: boolean }> {
    return this.sendWebNotification(options.title, options.message);
  }
  
  private async sendWebNotification(title: string, body: string): Promise<{ success: boolean }> {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações');
      return { success: false };
    }
    
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/logo.png',
          badge: '/logo.png',
          tag: 'motohub-' + Date.now(),
          renotify: true,
          vibrate: [200, 100, 200],
        } as any);
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
        return { success: true };
      } catch (err) {
        console.warn('Erro ao enviar notificação web:', err);
        return { success: false };
      }
    }
    
    return { success: false };
  }
}
