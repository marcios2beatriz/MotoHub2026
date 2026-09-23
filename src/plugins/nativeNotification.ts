import { registerPlugin } from '@capacitor/core';

export interface NativeNotificationPlugin {
  /**
   * Envia notificação nativa de chat na barra do Android
   * @param options Opções da notificação
   */
  sendChatNotification(options: {
    title: string;
    message: string;
    fromUserName: string;
  }): Promise<{ success: boolean }>;
  
  /**
   * Envia notificação nativa de escala na barra do Android
   * @param options Opções da notificação
   */
  sendScheduleNotification(options: {
    title: string;
    message: string;
  }): Promise<{ success: boolean }>;
  
  /**
   * Envia notificação geral na barra do Android
   * @param options Opções da notificação
   */
  sendGeneralNotification(options: {
    title: string;
    message: string;
  }): Promise<{ success: boolean }>;
}

const NativeNotification = registerPlugin<NativeNotificationPlugin>('NativeNotification', {
  web: () => import('./nativeNotificationWeb').then(m => new m.NativeNotificationWeb()),
});

export default NativeNotification;
