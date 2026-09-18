import { supabase } from './supabase';
import { db } from './db';
import { sendDeviceNotification, playNotificationSound } from './notifications';

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

export interface ChatNotificationPayload {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  message: string;
  timestamp: number;
  type: 'delivery_chat' | 'schedule_chat';
  entityId: string; // deliveryId ou scheduleId
}

export interface ScheduleNotificationPayload {
  riderId: string;
  riderName: string;
  establishmentId: string;
  establishmentName: string;
  action: 'created' | 'updated' | 'deleted';
  date: string;
  shift: string;
  timestamp: number;
}

type LocationCallback = (payload: LocationPayload) => void;
type OfflineCallback = (payload: OfflinePayload) => void;
type ChatNotificationCallback = (payload: ChatNotificationPayload) => void;
type ScheduleNotificationCallback = (payload: ScheduleNotificationPayload) => void;

class RealtimeGpsManager {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private listeners: Set<LocationCallback> = new Set();
  private offlineListeners: Set<OfflineCallback> = new Set();
  private chatListeners: Set<ChatNotificationCallback> = new Set();
  private scheduleListeners: Set<ScheduleNotificationCallback> = new Set();
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
      .on('broadcast', { event: 'chat-message' }, (response) => {
        const payload = response.payload as ChatNotificationPayload;
        if (payload && payload.fromUserId && payload.toUserId && payload.message) {
          // Processar notificação de chat
          this.handleChatNotification(payload);
          this.chatListeners.forEach((listener) => listener(payload));
        }
      })
      .on('broadcast', { event: 'schedule-update' }, (response) => {
        const payload = response.payload as ScheduleNotificationPayload;
        if (payload && payload.riderId) {
          // Processar notificação de escala
          this.handleScheduleNotification(payload);
          this.scheduleListeners.forEach((listener) => listener(payload));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          console.log('🔄 Realtime conectado: GPS + Notificações ativas');
        }
      });
  }

  private handleChatNotification(payload: ChatNotificationPayload) {
    const currentUser = db.getCurrentUser();
    if (!currentUser || payload.fromUserId === currentUser.id) return;

    // Só notificar se a mensagem é para o usuário atual
    if (payload.toUserId === currentUser.id) {
      const title = `💬 Mensagem de ${payload.fromUserName}`;
      const body = payload.message.length > 50 
        ? `${payload.message.substring(0, 50)}...` 
        : payload.message;

      sendDeviceNotification(title, body);
      playNotificationSound();
    }
  }

  private handleScheduleNotification(payload: ScheduleNotificationPayload) {
    const currentUser = db.getCurrentUser();
    if (!currentUser || payload.riderId !== currentUser.id) return;

    let title = '';
    let body = '';

    switch (payload.action) {
      case 'created':
        title = '📅 Nova Escala Recebida!';
        body = `Você foi escalado para ${payload.establishmentName} no turno da ${this.getShiftLabel(payload.shift)} em ${new Date(payload.date).toLocaleDateString('pt-BR')}`;
        break;
      case 'updated':
        title = '📝 Escala Atualizada';
        body = `Sua escala em ${payload.establishmentName} foi modificada para ${this.getShiftLabel(payload.shift)} em ${new Date(payload.date).toLocaleDateString('pt-BR')}`;
        break;
      case 'deleted':
        title = '❌ Escala Cancelada';
        body = `Sua escala em ${payload.establishmentName} para ${new Date(payload.date).toLocaleDateString('pt-BR')} foi cancelada`;
        break;
    }

    sendDeviceNotification(title, body);
    playNotificationSound();
  }

  private getShiftLabel(shift: string): string {
    switch (shift) {
      case 'morning': return 'manhã';
      case 'afternoon': return 'tarde';
      case 'night': return 'noite';
      default: return shift;
    }
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

  public subscribeToChatNotifications(callback: ChatNotificationCallback) {
    this.chatListeners.add(callback);
    if (!this.channel) this.init();
    return () => {
      this.chatListeners.delete(callback);
    };
  }

  public subscribeToScheduleNotifications(callback: ScheduleNotificationCallback) {
    this.scheduleListeners.add(callback);
    if (!this.channel) this.init();
    return () => {
      this.scheduleListeners.delete(callback);
    };
  }

  public sendChatNotification(payload: ChatNotificationPayload) {
    if (!this.channel) this.init();

    if (this.channel && this.isSubscribed) {
      this.channel.send({
        type: 'broadcast',
        event: 'chat-message',
        payload
      }).catch((err) => {
        console.warn('Erro ao enviar notificação de chat:', err);
      });
    }
  }

  public sendScheduleNotification(payload: ScheduleNotificationPayload) {
    if (!this.channel) this.init();

    if (this.channel && this.isSubscribed) {
      this.channel.send({
        type: 'broadcast',
        event: 'schedule-update',
        payload
      }).catch((err) => {
        console.warn('Erro ao enviar notificação de escala:', err);
      });
    }
  }
}

export const realtimeGps = new RealtimeGpsManager();
realtimeGps.init();