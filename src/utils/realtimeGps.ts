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
    // 🔥 IMPORTANTE: Prevenir inicialização múltipla
    if (this.pollingInterval !== null) {
      console.log('⚠️ RealtimeGps já inicializado - ignorando chamada duplicada');
      return;
    }

    console.log('🚀 Inicializando GPS Manager (APENAS POLLING - Realtime desabilitado)');

    // 🔥 DESABILITAR Realtime (instável, desconecta constantemente)
    // Usar APENAS polling (mais estável e funciona perfeitamente)
    this.startPollingFallback();
    
    // Detectar quando app volta do background e reconectar
    this.setupVisibilityListener();
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
      // 🔥 OTIMIZAÇÃO: Só buscar se há listeners ativos
      if (this.listeners.size === 0) {
        console.log('⚡ fetchLatestLocations: Sem listeners, pulando busca');
        return;
      }

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      console.log('🔍 Buscando localizações manuais desde:', fiveMinutesAgo);
      
      const { data, error } = await supabase
        .from('rider_locations')
        .select('rider_id, rider_name, lat, lng, updated_at')
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

  // 🔥 OTIMIZADO: Polling inteligente com redução de frequência - ECONOMIA 75% DB
  private startPollingFallback() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    console.log('🔄 Iniciando polling OTIMIZADO (15s normal, 5s quando ativo)');
    
    let lastPollTime = Date.now();
    let lastKnownPositions = new Map<string, {lat: number, lng: number, timestamp: number}>();
    let consecutiveEmptyPolls = 0;
    let currentInterval = 15000; // Começar com 15s

    const executePolling = async () => {
      const now = Date.now();
      const timeSinceLastPoll = now - lastPollTime;
      
      // 🔥 Detectar se setInterval foi pausado (gap > 25 segundos indica background)
      if (timeSinceLastPoll > 25000) {
        console.warn(`⚠️ Polling pausado por ${Math.round(timeSinceLastPoll / 1000)}s (app em background)`);
        console.log('🔄 App voltou - fazendo catch-up de atualizações perdidas');
        
        // 🆕 CATCH-UP: Buscar últimos 2 minutos para recuperar o que perdeu
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: catchupData } = await supabase
          .from('rider_locations')
          .select('rider_id, rider_name, lat, lng, updated_at')
          .gte('updated_at', twoMinutesAgo)
          .order('updated_at', { ascending: false });
        
        if (catchupData && catchupData.length > 0) {
          console.log(`✅ Catch-up: Recuperadas ${catchupData.length} posições durante pausa`);
          catchupData.forEach((loc: any) => {
            if (loc.rider_id && loc.lat && loc.lng) {
              db.updateRiderLocation(
                loc.rider_id,
                loc.rider_name || '',
                parseFloat(loc.lat),
                parseFloat(loc.lng)
              );
              this.listeners.forEach(listener => {
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
          window.dispatchEvent(new CustomEvent('gps-background-catchup', {
            detail: { count: catchupData.length, timestamp: Date.now() }
          }));
        }
      }
      
      lastPollTime = now;
      
      // 📊 ECONOMIA: Só executar se houver listeners (usuários vendo o mapa)
      if (this.listeners.size === 0) {
        consecutiveEmptyPolls++;
        return;
      }
      
      try {
        // 🔥 OTIMIZAÇÃO CRÍTICA: Buscar apenas últimos 45 SEGUNDOS (não 30s)
        // Isso permite capturar dados mesmo com polling de 15s
        const fortyFiveSecondsAgo = new Date(Date.now() - 45 * 1000).toISOString();
        
        const { data, error } = await supabase
          .from('rider_locations')
          .select('rider_id, rider_name, lat, lng, updated_at')
          .gte('updated_at', fortyFiveSecondsAgo)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('❌ Erro no polling:', error);
          return;
        }

        if (data && data.length > 0) {
          let updatesCount = 0;
          consecutiveEmptyPolls = 0; // Reset contador de polls vazios
          
          // Atualizar localizações locais E notificar listeners
          data.forEach((loc: any) => {
            if (loc.rider_id && loc.lat && loc.lng) {
              const lat = parseFloat(loc.lat);
              const lng = parseFloat(loc.lng);
              const timestamp = new Date(loc.updated_at).getTime();
              
              // 🔥 Verificar se a posição MUDOU significativamente (5m de precisão)
              const lastKnown = lastKnownPositions.get(loc.rider_id);
              const hasMoved = !lastKnown || 
                Math.abs(lastKnown.lat - lat) > 0.00005 || // ~5.6m de precisão
                Math.abs(lastKnown.lng - lng) > 0.00005;
              
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
            
            // 🚀 ADAPTATIVO: Se há movimento, acelerar próxima poll para 5s
            currentInterval = 5000;
            
            // 🔥 Forçar atualização visual do mapa
            window.dispatchEvent(new CustomEvent('gps-polling-update', {
              detail: { count: updatesCount, timestamp: Date.now() }
            }));
          } else {
            consecutiveEmptyPolls++;
            // 🐌 Se não há movimento, desacelerar para 15s (economia de recursos)
            if (consecutiveEmptyPolls >= 2) {
              currentInterval = 15000;
            }
          }
        } else {
          consecutiveEmptyPolls++;
          // 💤 Sem dados = reduzir frequência
          if (consecutiveEmptyPolls >= 3) {
            currentInterval = 20000; // 20s quando completamente inativo
          }
        }
      } catch (err) {
        console.error('❌ Exceção no polling:', err);
      }
    };

    // 🔥 Polling dinâmico que se ajusta automaticamente
    const scheduleNext = () => {
      this.pollingInterval = setTimeout(() => {
        executePolling().then(scheduleNext);
      }, currentInterval);
    };

    // Executar primeira poll imediatamente
    executePolling().then(scheduleNext);
    
    console.log('✅ Polling OTIMIZADO configurado (adaptativo 5-20s)');
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