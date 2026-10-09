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
    if (this.channel) {
      console.log('⚠️ RealtimeGps já inicializado');
      return;
    }

    console.log('🚀 Inicializando canal Realtime do Supabase (DATABASE CHANGES)...');

    // 🔥 MUDANÇA: Usar postgres_changes ao invés de broadcast
    // Isso é MUITO mais confiável e NÃO desconecta
    this.channel = supabase.channel('rider-locations-changes');

    this.channel
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'rider_locations' 
        }, 
        (payload) => {
          console.log('📡 [REALTIME DATABASE] rider_locations mudou:', payload);
          
          if (payload.new && typeof payload.new === 'object' && 'rider_id' in payload.new) {
            const newData = payload.new as { 
              rider_id: string; 
              rider_name?: string; 
              lat: number; 
              lng: number;
            };
            
            const locationPayload: LocationPayload = {
              riderId: newData.rider_id,
              riderName: newData.rider_name || '',
              lat: parseFloat(String(newData.lat)),
              lng: parseFloat(String(newData.lng)),
              speedKmh: 0,
              heading: 0,
              timestamp: Date.now()
            };
            
            this.lastActivity = Date.now();
            db.updateRiderLocation(locationPayload.riderId, locationPayload.riderName, locationPayload.lat, locationPayload.lng);
            this.listeners.forEach((listener) => listener(locationPayload));
          }
        }
      )
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
          this.reconnectAttempts = 0;
          console.log('✅ Realtime conectado: Database Changes ativo (rider_locations)');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('⚠️ Realtime desconectado:', status);
          this.isSubscribed = false;
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            setTimeout(() => this.reconnect(), 5000); // 5s delay antes de reconectar
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

    console.log('📤 [REALTIME] Salvando no banco (database changes vai notificar automaticamente):', {
      riderId: payload.riderId,
      riderName: payload.riderName,
      lat: payload.lat,
      lng: payload.lng
    });

    // ✅ MUDANÇA: Não precisa mais de broadcast!
    // O postgres_changes vai detectar automaticamente quando salvamos no banco
    
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

  // 🔥 MELHORADO: Polling AGRESSIVO (5s) estilo Google Maps - OTIMIZADO
  private startPollingFallback() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    console.log('🔄 Iniciando polling AGRESSIVO (5s - estilo Google Maps)');
    
    let lastPollTime = Date.now();
    let lastKnownPositions = new Map<string, {lat: number, lng: number, timestamp: number}>();

    this.pollingInterval = setInterval(async () => {
      const now = Date.now();
      const timeSinceLastPoll = now - lastPollTime;
      
      // 🔥 Detectar se setInterval foi pausado (gap > 8 segundos indica background)
      if (timeSinceLastPoll > 8000) {
        console.warn(`⚠️ Polling pausado por ${Math.round(timeSinceLastPoll / 1000)}s (app em background)`);
      }
      
      lastPollTime = now;
      
      // Só executar se houver listeners (usuários vendo o mapa)
      if (this.listeners.size === 0) {
        return;
      }
      
      try {
        // 🔥 OTIMIZADO: Buscar apenas últimos 30 SEGUNDOS (não 5 minutos!)
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
        
        const { data, error } = await supabase
          .from('rider_locations')
          .select('rider_id, rider_name, lat, lng, updated_at')
          .gte('updated_at', thirtySecondsAgo)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('❌ Erro no polling:', error);
          return;
        }

        if (data && data.length > 0) {
          let updatesCount = 0;
          
          // Atualizar localizações locais E notificar listeners
          data.forEach((loc: any) => {
            if (loc.rider_id && loc.lat && loc.lng) {
              const lat = parseFloat(loc.lat);
              const lng = parseFloat(loc.lng);
              const timestamp = new Date(loc.updated_at).getTime();
              
              // 🔥 Verificar se a posição MUDOU (evitar re-renders desnecessários)
              const lastKnown = lastKnownPositions.get(loc.rider_id);
              const hasMoved = !lastKnown || 
                Math.abs(lastKnown.lat - lat) > 0.00001 || 
                Math.abs(lastKnown.lng - lng) > 0.00001;
              
              if (hasMoved) {
                updatesCount++;
                
                // Salvar nova posição
                lastKnownPositions.set(loc.rider_id, { lat, lng, timestamp });
                
                // Atualizar cache local
                db.updateRiderLocation(loc.rider_id, loc.rider_name || '', lat, lng);
                
                // 🔥 Notificar listeners IMEDIATAMENTE
                this.listeners.forEach((listener) => {
                  listener({
                    riderId: loc.rider_id,
                    riderName: loc.rider_name || '',
                    lat,
                    lng,
                    timestamp
                  });
                });
              }
            }
          });
          
          if (updatesCount > 0) {
            console.log(`✅ Polling: ${updatesCount} motoboy(s) se moveram`);
            
            // 🔥 Forçar atualização visual do mapa
            window.dispatchEvent(new CustomEvent('gps-polling-update', {
              detail: { count: updatesCount, timestamp: Date.now() }
            }));
          }
        }
      } catch (err) {
        console.error('❌ Exceção no polling:', err);
      }
    }, 5000); // 🔥 5 SEGUNDOS - estilo Google Maps
    
    console.log('✅ Polling AGRESSIVO configurado (5s)');
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