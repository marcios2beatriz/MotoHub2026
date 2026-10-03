import { supabase } from './supabase';
import { db } from './db';
import { sendDeviceNotification, playNotificationSound } from './notifications';
import { Capacitor } from '@capacitor/core';
import NativeNotification from '../plugins/nativeNotification';

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
  private reconnectInterval: number | null = null;
  private lastActivity = Date.now();
  private pollingInterval: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

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
          this.lastActivity = Date.now(); // 🔥 Marca última atividade
          db.updateRiderLocation(payload.riderId, payload.riderName, payload.lat, payload.lng);
          this.listeners.forEach((listener) => listener(payload));
        }
      })
      .on('broadcast', { event: 'rider-offline' }, (response) => {
        const payload = response.payload as OfflinePayload;
        if (payload && payload.riderId) {
          this.lastActivity = Date.now(); // 🔥 Marca última atividade
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
          this.lastActivity = Date.now(); // 🔥 Marca última atividade
          // Processar notificação de chat
          this.handleChatNotification(payload);
          this.chatListeners.forEach((listener) => listener(payload));
        }
      })
      .on('broadcast', { event: 'schedule-update' }, (response) => {
        const payload = response.payload as ScheduleNotificationPayload;
        if (payload && payload.riderId) {
          this.lastActivity = Date.now(); // 🔥 Marca última atividade
          // Processar notificação de escala
          this.handleScheduleNotification(payload);
          this.scheduleListeners.forEach((listener) => listener(payload));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          this.reconnectAttempts = 0; // Reset contador
          console.log('✅ Realtime conectado: GPS + Notificações ativas');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('⚠️ Realtime desconectado:', status);
          this.isSubscribed = false;
          
          // 🔥 Limitar tentativas de reconexão para evitar loop infinito
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            setTimeout(() => this.reconnect(), 3000);
          } else {
            console.warn('❌ Realtime falhou após 3 tentativas - usando apenas polling');
          }
        }
      });

    // 🔥 NOVO: Detectar quando app volta do background e reconectar
    this.setupVisibilityListener();
    
    // 🔥 NOVO: Watchdog para verificar se ainda está recebendo dados
    this.startConnectionWatchdog();
    
    // 🔥 NOVO: Polling de fallback (busca do Supabase a cada 10s caso realtime falhe)
    this.startPollingFallback();
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

      // Usar notificação nativa no Android/iOS, fallback para web
      if (Capacitor.isNativePlatform()) {
        NativeNotification.sendChatNotification({
          title,
          message: body,
          fromUserName: payload.fromUserName
        }).catch(() => {
          // Fallback para notificação web
          sendDeviceNotification(title, body);
        });
      } else {
        sendDeviceNotification(title, body);
      }
      
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

    // Usar notificação nativa no Android/iOS, fallback para web
    if (Capacitor.isNativePlatform()) {
      NativeNotification.sendScheduleNotification({
        title,
        message: body
      }).catch(() => {
        // Fallback para notificação web
        sendDeviceNotification(title, body);
      });
    } else {
      sendDeviceNotification(title, body);
    }
    
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

  // 🔥 NOVO: Reconectar canal Realtime
  private reconnect() {
    console.log('🔄 Tentando reconectar Realtime...');
    
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    
    this.isSubscribed = false;
    this.init();
  }

  // 🔥 NOVO: Detecta quando app volta do background
  private setupVisibilityListener() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('📱 App voltou ao foreground - sincronizando GPS');
        
        // ✅ CORREÇÃO: Forçar busca manual do Supabase imediatamente
        this.fetchLatestLocations();
        
        // Se não está subscrito E ainda tem tentativas, reconectar
        if (!this.isSubscribed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      }
    });
  }
  
  // 🔥 NOVO: Busca manual de localizações (executado ao voltar do background)
  private async fetchLatestLocations() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      console.log('🔍 Buscando localizações manuais desde:', fiveMinutesAgo);
      
      const { data, error } = await supabase
        .from('rider_locations')
        .select('*')
        .gte('updated_at', fiveMinutesAgo);

      if (error) {
        console.error('❌ Erro ao buscar localizações:', error);
        return;
      }

      console.log(`✅ Encontradas ${data?.length || 0} localizações`);

      if (data && data.length > 0) {
        data.forEach((loc: any) => {
          if (loc.rider_id && loc.lat && loc.lng) {
            db.updateRiderLocation(
              loc.rider_id,
              loc.rider_name || '',
              parseFloat(loc.lat),
              parseFloat(loc.lng)
            );
            
            // Notificar listeners do mapa
            this.listeners.forEach((listener) => {
              listener({
                riderId: loc.rider_id,
                riderName: loc.rider_name || '',
                lat: parseFloat(loc.lat),
                lng: parseFloat(loc.lng),
                timestamp: new Date(loc.updated_at).getTime()
              });
            });
          }
        });
        
        // 🔥 Disparar evento customizado para forçar re-render do mapa
        window.dispatchEvent(new CustomEvent('gps-foreground-update', {
          detail: { count: data.length, timestamp: Date.now() }
        }));
      }
    } catch (err) {
      console.error('❌ Exceção ao buscar localizações:', err);
    }
  }

  // 🔥 NOVO: Watchdog para detectar se conexão está morta
  private startConnectionWatchdog() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    this.reconnectInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivity;
      
      // Se não recebe dados há mais de 30 segundos E deveria estar conectado
      if (timeSinceActivity > 30000 && this.isSubscribed) {
        console.warn('⚠️ Sem atividade Realtime há 30s - reconectando...');
        this.reconnect();
      }
    }, 15000); // Verifica a cada 15s
  }

  // 🔥 MELHORADO: Polling de fallback com proteção contra pausas do navegador
  private startPollingFallback() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    console.log('🔄 Iniciando polling de fallback (30s)');
    
    let lastPollTime = Date.now();

    this.pollingInterval = setInterval(async () => {
      const now = Date.now();
      const timeSinceLastPoll = now - lastPollTime;
      
      // 🔥 Detectar se setInterval foi pausado (gap > 35 segundos indica background)
      if (timeSinceLastPoll > 35000) {
        console.warn(`⚠️ Polling pausado por ${Math.round(timeSinceLastPoll / 1000)}s (navegador em background)`);
      }
      
      lastPollTime = now;
      
      console.log('📊 Polling executando... listeners:', this.listeners.size);
      
      try {
        // Buscar localizações recentes (últimos 5 minutos)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        console.log('🔍 Buscando localizações desde:', fiveMinutesAgo);
        
        const { data, error } = await supabase
          .from('rider_locations')
          .select('*')
          .gte('updated_at', fiveMinutesAgo);

        if (error) {
          console.error('❌ Erro no polling:', error);
          return;
        }

        console.log(`✅ Polling encontrou ${data?.length || 0} localizações`);

        if (data && data.length > 0) {
          // Atualizar localizações locais
          data.forEach((loc: any) => {
            if (loc.rider_id && loc.lat && loc.lng) {
              db.updateRiderLocation(
                loc.rider_id,
                loc.rider_name || '',
                parseFloat(loc.lat),
                parseFloat(loc.lng)
              );
              
              console.log(`📍 Atualizando ${loc.rider_name}: ${loc.lat}, ${loc.lng}`);
              
              // Notificar listeners
              this.listeners.forEach((listener) => {
                listener({
                  riderId: loc.rider_id,
                  riderName: loc.rider_name || '',
                  lat: parseFloat(loc.lat),
                  lng: parseFloat(loc.lng),
                  timestamp: new Date(loc.updated_at).getTime()
                });
              });
            }
          });
          
          // 🔥 Forçar atualização do mapa
          window.dispatchEvent(new CustomEvent('gps-polling-update', {
            detail: { count: data.length, timestamp: Date.now() }
          }));
        }
      } catch (err) {
        console.error('❌ Exceção no polling de fallback:', err);
      }
    }, 30000); // Aumentado para 30s (mais eficiente)
    
    console.log('✅ Polling de fallback configurado (30s)');
  }

  // 🔥 NOVO: Cleanup ao destruir
  public destroy() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

export const realtimeGps = new RealtimeGpsManager();
realtimeGps.init();