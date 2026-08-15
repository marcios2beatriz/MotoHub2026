"use client";

import { createClient } from '@supabase/supabase-js';
import { realtimeGps } from './realtimeGps';

// Configuração do Supabase utilizando variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rqieirvzutdculcdsncb.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pjEo4HVVSPTMF-fQDwKpLQ_o9HAIOWR';
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'establishment' | 'rider';
  active: boolean;
  createdAt?: string;
  phone: string;
  cpf: string;
  passwordHash: string;
  mustResetPassword?: boolean;
  establishmentId?: string;
  updatedAt?: string;
}

export interface Establishment {
  id: string;
  name: string;
  email?: string;
  active: boolean;
  phone: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Schedule {
  id: string;
  riderId: string;
  establishmentId: string;
  date: string; // YYYY-MM-DD
  shift: 'morning' | 'afternoon' | 'night';
  startTime: string;
  endTime: string;
  chat?: string; // Histórico de chat do turno
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Delivery {
  id: string;
  riderId: string;
  establishmentId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  value: number;
  status: 'pending' | 'active' | 'rejected' | 'cancelled' | 'lost';
  scheduleId?: string;
  orderNumber?: string;
  notes?: string; // Chat/Observações com o estabelecimento
  customerChat?: string; // Chat com o cliente final
  updatedAt?: string;
  paid?: boolean;
  lostAt?: string;    // ISO timestamp de quando foi perdida
  lostReason?: string; // motivo: 'logout' | 'session_limit'
}

export interface Notification {
  id: string;
  riderId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface PartnerRequest {
  id: string;
  establishmentName: string;
  ownerName: string;
  phone: string;
  address: string;
  status: 'pending' | 'contacted';
  createdAt: string;
}

export interface RiderLocation {
  riderId: string;
  riderName: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface QueueEntry {
  id: string;
  riderId: string;
  establishmentId: string;
  date: string; // YYYY-MM-DD
  joinedAt: string; // ISO string
  status: 'waiting' | 'delivering' | 'left';
  updatedAt: string;
}

export interface RouteHistoryItem {
  id: string;
  riderId: string;
  riderName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  originName: string;
  destinationName: string;
  destinationAddress: string;
  destinationLat?: number;
  destinationLng?: number;
  waypointsCount: number;
  distanceMeters: number;
  durationSeconds: number;
  createdAt: string; // ISO
}

// Helper para comparação de datas flexível
export function isSameDayString(d1?: string, d2?: string): boolean {
  if (!d1 || !d2) return false;
  const clean1 = d1.split('T')[0].split(' ')[0];
  const clean2 = d2.split('T')[0].split(' ')[0];
  if (clean1 === clean2) return true;
  try {
    const dt1 = new Date(d1.includes('T') ? d1 : d1.replace(' ', 'T'));
    const dt2 = new Date(d2.includes('T') ? d2 : d2.replace(' ', 'T')); 
    return dt1.getFullYear() === dt2.getFullYear() &&
           dt1.getMonth() === dt2.getMonth() &&
           dt1.getDate() === dt2.getDate();
  } catch (e) {
    return false;
  }
}

function parseTimestamp(dateStr?: string): number {
  if (!dateStr) return 0;
  try {
    const formatted = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const t = new Date(formatted).getTime();
    return isNaN(t) ? 0 : t;
  } catch (e) {
    return 0;
  }
}

// Chaves para o LocalStorage
const KEYS = {
  USERS: 'delivery_system_users',
  ESTABLISHMENTS: 'delivery_system_establishments',
  SCHEDULES: 'delivery_system_schedules',
  DELIVERIES: 'delivery_system_deliveries',
  NOTIFICATIONS: 'delivery_system_notifications',
  CURRENT_USER: 'delivery_system_current_user',
  RIDER_LOCATIONS: 'delivery_system_rider_locations',
  PARTNER_REQUESTS: 'delivery_system_partner_requests',
  RIDER_QUEUE: 'delivery_system_rider_queue',
  ROUTE_HISTORY: 'delivery_system_route_history',
  MISSING_COLUMNS: 'delivery_system_missing_columns',
  MISSING_TABLES: 'delivery_system_missing_tables',
  SESSION_LOGIN_TIME: 'delivery_system_session_login_time',
  SESSION_DELIVERY_COUNT: 'delivery_system_session_delivery_count',
  DELIVERY_PRESENCE: 'delivery_system_delivery_presence',
};

const getMissingColumnsCache = (): Record<string, string[]> => {
  const data = localStorage.getItem(KEYS.MISSING_COLUMNS);
  return data ? JSON.parse(data) : {};
};

const saveMissingColumnsCache = (cache: Record<string, string[]>) => {
  localStorage.setItem(KEYS.MISSING_COLUMNS, JSON.stringify(cache));
};

function getInitialMissingTables(): string[] {
  try {
    const data = localStorage.getItem(KEYS.MISSING_TABLES);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

const missingTables = new Set<string>(getInitialMissingTables());

function markTableMissing(tableName: string) {
  missingTables.add(tableName);
  try {
    localStorage.setItem(KEYS.MISSING_TABLES, JSON.stringify(Array.from(missingTables)));
  } catch (e) {}
}

function isTableMissing(tableName: boolean | string): boolean {
  if (typeof tableName === 'boolean') return tableName;
  return missingTables.has(tableName);
}

// Canal de comunicação em tempo real via Broadcast do Supabase para sincronizar a Fila
let queueBroadcastChannel: ReturnType<typeof supabase.channel> | null = null;
let isQueueChannelSubscribed = false;

function initQueueRealtime() {
  if (queueBroadcastChannel) return;
  
  queueBroadcastChannel = supabase.channel('rider-queue-sync-channel', {
    config: { broadcast: { self: false } }
  });

  queueBroadcastChannel
    .on('broadcast', { event: 'queue-changed' }, (response) => {
      if (response && response.payload && Array.isArray(response.payload.queue)) {
        const remoteQueue: QueueEntry[] = response.payload.queue;
        const localQueue = db.getQueue();
        
        const mergedList = db.sanitizeQueue([...localQueue, ...remoteQueue]);
        localStorage.setItem(KEYS.RIDER_QUEUE, JSON.stringify(mergedList));
        window.dispatchEvent(new Event('queue-updated'));
      }
    })
    .on('broadcast', { event: 'request-queue' }, () => {
      const currentQueue = db.getQueue();
      if (queueBroadcastChannel && isQueueChannelSubscribed) {
        queueBroadcastChannel.send({
          type: 'broadcast',
          event: 'queue-changed',
          payload: { queue: currentQueue, timestamp: Date.now() }
        }).catch(() => {});
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isQueueChannelSubscribed = true;
        queueBroadcastChannel?.send({
          type: 'broadcast',
          event: 'request-queue',
          payload: { timestamp: Date.now() }
        }).catch(() => {});

        const currentQueue = db.getQueue();
        if (currentQueue.length > 0) {
          queueBroadcastChannel?.send({
            type: 'broadcast',
            event: 'queue-changed',
            payload: { queue: currentQueue, timestamp: Date.now() }
          }).catch(() => {});
        }
      } else {
        isQueueChannelSubscribed = false;
      }
    });
}

initQueueRealtime();

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      initQueueRealtime();
      broadcastQueueChange();
    }
  });

  window.addEventListener('online', () => {
    initQueueRealtime();
    broadcastQueueChange();
  });
}

function broadcastQueueChange(currentQueue?: QueueEntry[]) {
  initQueueRealtime();
  const queueToSend = currentQueue || db.getQueue();

  if (queueBroadcastChannel && isQueueChannelSubscribed) {
    queueBroadcastChannel.send({
      type: 'broadcast',
      event: 'queue-changed',
      payload: { queue: queueToSend, timestamp: Date.now() }
    }).catch(() => {});
  } else if (queueBroadcastChannel) {
    queueBroadcastChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isQueueChannelSubscribed = true;
        queueBroadcastChannel?.send({
          type: 'broadcast',
          event: 'queue-changed',
          payload: { queue: queueToSend, timestamp: Date.now() }
        }).catch(() => {});
      }
    });
  }
}

function mergeChatStrings(localChat: string | undefined, remoteChat: string | undefined): string {
  if (!localChat) return remoteChat || '';
  if (!remoteChat) return localChat || '';
  if (localChat === remoteChat) return localChat;
  
  const localLines = localChat.split('\n').map(l => l.trim()).filter(Boolean);
  const remoteLines = remoteChat.split('\n').map(l => l.trim()).filter(Boolean);
  
  const merged: string[] = [];
  const seen = new Set<string>();
  
  localLines.forEach(l => {
    merged.push(l);
    seen.add(l);
  });
  
  remoteLines.forEach(l => {
    if (!seen.has(l)) {
      merged.push(l);
      seen.add(l);
    }
  });

  return merged.join('\n');
}

function isAddressEmptyOrPlaceholder(addr: any): boolean {
  if (!addr) return true;
  const street = (addr.street || '').toLowerCase().trim();
  const neighborhood = (addr.neighborhood || '').toLowerCase().trim();
  
  return !street || !neighborhood || street === 'sem rua' || street === 'a definir' || neighborhood === 'sem bairro' || neighborhood === 'a definir';
}

async function safeUpsert(tableName: string, rawPayload: Record<string, any>): Promise<{ success: boolean; error?: any }> {
  if (isTableMissing(tableName)) {
    return { success: false, error: 'Tabela não existe no Supabase' };
  }

  const payload = { ...rawPayload };
  
  const cache = getMissingColumnsCache();
  const missingCols = cache[tableName] || [];
  missingCols.forEach(col => {
    delete payload[col];
  });

  const maxRetries = 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { error } = await supabase.from(tableName).upsert(payload);
    
    if (!error) {
      return { success: true };
    }

    const msg = error.message || '';
    if (msg.includes('Could not find the table') || error.code === 'PGRST205' || (error as any).status === 404) {
      markTableMissing(tableName);
      return { success: false, error };
    }

    const match = msg.match(/Could not find the '([^']+)' column/) || 
                  msg.match(/column "([^"]+)"/) || 
                  msg.match(/column '([^']+)'/);
    
    if (match && match[1]) {
      const missingCol = match[1];
      const currentCache = getMissingColumnsCache();
      if (!currentCache[tableName]) currentCache[tableName] = [];
      if (!currentCache[tableName].includes(missingCol)) {
        currentCache[tableName].push(missingCol);
        saveMissingColumnsCache(currentCache);
      }

      delete payload[missingCol];
      continue;
    }

    return { success: false, error };
  }

  return { success: false, error: 'Limite de tentativas de auto-cura excedido' };
}

export const db = {
  isSameDayString,

  getUsers(): User[] {
    const data = localStorage.getItem(KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },
  setUsers(users: User[]) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    users.forEach(u => {
      const rawPayload = {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        phone: u.phone,
        cpf: u.cpf,
        password_hash: u.passwordHash,
        must_reset_password: u.mustResetPassword || false,
        establishment_id: u.establishmentId || null,
        created_at: u.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      safeUpsert('users', rawPayload);
    });
  },

  getEstablishments(): Establishment[] {
    const data = localStorage.getItem(KEYS.ESTABLISHMENTS);
    return data ? JSON.parse(data) : [];
  },
  setEstablishments(ests: Establishment[]) {
    localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(ests));
    ests.forEach(e => {
      const rawPayload = {
        id: e.id,
        name: e.name,
        email: e.email || null,
        active: e.active,
        phone: e.phone || '',
        address: typeof e.address === 'object' ? JSON.stringify(e.address) : e.address,
        street: e.address?.street || '',
        number: e.address?.number || '',
        complement: e.address?.complement || '',
        neighborhood: e.address?.neighborhood || '',
        city: e.address?.city || '',
        state: e.address?.state || '',
        zip_code: e.address?.zipCode || '',
        created_at: e.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      safeUpsert('establishments', rawPayload);
    });
  },

  getSchedules(): Schedule[] {
    const data = localStorage.getItem(KEYS.SCHEDULES);
    return data ? JSON.parse(data) : [];
  },
  setSchedules(schedules: Schedule[]) {
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(schedules));
    schedules.forEach(s => {
      const serializedCreatedBy = JSON.stringify({
        createdBy: s.createdBy || '',
        chat: s.chat || '',
        updatedAt: s.updatedAt || new Date().toISOString()
      });

      const rawPayload = {
        id: s.id,
        rider_id: s.riderId,
        establishment_id: s.establishmentId,
        date: s.date,
        shift: s.shift,
        start_time: s.startTime,
        end_time: s.endTime,
        chat: s.chat || null,
        created_by: serializedCreatedBy,
        created_at: s.createdAt || new Date().toISOString(),
        updated_at: s.updatedAt || new Date().toISOString()
      };
      safeUpsert('schedules', rawPayload);
    });
  },

  getDeliveries(): Delivery[] {
    const data = localStorage.getItem(KEYS.DELIVERIES);
    return data ? JSON.parse(data) : [];
  },
  setDeliveries(deliveries: Delivery[]) {
    localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(deliveries));
    deliveries.forEach(d => {
      const serializedOrderNumber = JSON.stringify({
        orderNumber: d.orderNumber || '',
        notes: d.notes || '',
        customerChat: d.customerChat || '',
        updatedAt: d.updatedAt || new Date().toISOString()
      });

      const rawPayload = {
        id: d.id,
        rider_id: d.riderId,
        establishment_id: d.establishmentId,
        date: d.date,
        time: d.time,
        value: d.value,
        status: d.status,
        schedule_id: d.scheduleId || null,
        order_number: serializedOrderNumber,
        notes: d.notes || null,
        customer_chat: d.customerChat || null,
        updated_at: d.updatedAt || new Date().toISOString(),
        paid: d.paid || false
      };
      safeUpsert('deliveries', rawPayload);
    });
  },

  async clearAllDeliveries() {
    localStorage.setItem(KEYS.DELIVERIES, JSON.stringify([]));
    if (!isTableMissing('deliveries')) {
      await supabase.from('deliveries').delete().neq('id', '');
    }
  },

  getNotifications(): Notification[] {
    const data = localStorage.getItem(KEYS.NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
  },
  setNotifications(notifications: Notification[]) {
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  },

  getPartnerRequests(): PartnerRequest[] {
    const data = localStorage.getItem(KEYS.PARTNER_REQUESTS);
    return data ? JSON.parse(data) : [];
  },
  setPartnerRequests(requests: PartnerRequest[]) {
    localStorage.setItem(KEYS.PARTNER_REQUESTS, JSON.stringify(requests));
    requests.forEach(r => {
      const rawPayload = {
        id: r.id,
        establishment_name: r.establishmentName,
        owner_name: r.ownerName,
        phone: r.phone,
        address: r.address,
        status: r.status,
        created_at: r.createdAt
      };
      safeUpsert('partner_requests', rawPayload);
    });
  },

  getQueue(): QueueEntry[] {
    const data = localStorage.getItem(KEYS.RIDER_QUEUE);
    const rawQueue: QueueEntry[] = data ? JSON.parse(data) : [];
    return this.sanitizeQueue(rawQueue);
  },
  
  sanitizeQueue(queue: QueueEntry[]): QueueEntry[] {
    if (!Array.isArray(queue)) return [];
    
    const map = new Map<string, QueueEntry>();

    queue.forEach(item => {
      if (!item || !item.riderId || !item.establishmentId) return;

      const user = this.resolveUser(item.riderId);
      const est = this.resolveEstablishment(item.establishmentId);

      const riderKey = user ? user.id : item.riderId;
      const estKey = est ? est.id : item.establishmentId;
      
      let dayKey = item.date ? item.date.split('T')[0].split(' ')[0] : '';
      if (!dayKey && item.joinedAt) {
        dayKey = this.getOperationalDateString(new Date(item.joinedAt));
      }
      if (!dayKey) {
        dayKey = this.getOperationalDateString();
      }

      const compositeKey = `${riderKey}_${estKey}_${dayKey}`;

      const existing = map.get(compositeKey);
      if (!existing) {
        map.set(compositeKey, item);
      } else {
        const existingTime = Math.max(parseTimestamp(existing.updatedAt), parseTimestamp(existing.joinedAt));
        const itemTime = Math.max(parseTimestamp(item.updatedAt), parseTimestamp(item.joinedAt));

        if (itemTime >= existingTime) {
          map.set(compositeKey, item);
        }
      }
    });

    return Array.from(map.values());
  },

  setQueue(queue: QueueEntry[]) {
    const sanitized = this.sanitizeQueue(queue);
    localStorage.setItem(KEYS.RIDER_QUEUE, JSON.stringify(sanitized));
    
    if (!isTableMissing('rider_queue')) {
      sanitized.forEach(q => {
        const rawPayload = {
          id: q.id,
          rider_id: q.riderId,
          establishment_id: q.establishmentId,
          date: q.date,
          joined_at: q.joinedAt,
          status: q.status,
          updated_at: q.updatedAt || new Date().toISOString()
        };
        safeUpsert('rider_queue', rawPayload).catch(() => {});
      });
    }

    window.dispatchEvent(new Event('queue-updated'));
    broadcastQueueChange(sanitized);
  },

  // --- HISTÓRICO DE ROTAS ---
  getRouteHistory(): RouteHistoryItem[] {
    const data = localStorage.getItem(KEYS.ROUTE_HISTORY);
    return data ? JSON.parse(data) : [];
  },
  setRouteHistory(history: RouteHistoryItem[]) {
    localStorage.setItem(KEYS.ROUTE_HISTORY, JSON.stringify(history));
    window.dispatchEvent(new Event('route-history-updated'));
  },
  addRouteHistory(item: RouteHistoryItem) {
    const current = this.getRouteHistory();
    const exists = current.some(c => c.riderId === item.riderId && c.destinationName === item.destinationName && Math.abs(new Date(c.createdAt).getTime() - new Date(item.createdAt).getTime()) < 30000);
    if (!exists) {
      const updated = [item, ...current].slice(0, 100);
      this.setRouteHistory(updated);
    }
  },

  joinQueue(riderId: string, establishmentId: string): QueueEntry[] {
    const todayStr = this.getOperationalDateString();
    const queue = this.getQueue();
    const nowISO = new Date().toISOString();

    const canonicalUser = this.resolveUser(riderId);
    const canonicalEst = this.resolveEstablishment(establishmentId);

    const actualRiderId = canonicalUser?.id || riderId;
    const actualEstId = canonicalEst?.id || establishmentId;

    const remainingQueue = queue.filter(q => {
      const isSameRider = this.isSameUser(q.riderId, actualRiderId);
      const isSameEst = this.isSameEstablishment(q.establishmentId, actualEstId);
      const isSameDay = isSameDayString(q.date, todayStr) || (q.joinedAt && isSameDayString(q.joinedAt, todayStr));
      return !(isSameRider && isSameEst && isSameDay);
    });

    const newEntry: QueueEntry = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      riderId: actualRiderId,
      establishmentId: actualEstId,
      date: todayStr,
      joinedAt: nowISO,
      status: 'waiting',
      updatedAt: nowISO
    };

    const updatedQueue = [...remainingQueue, newEntry];
    this.setQueue(updatedQueue);
    return updatedQueue;
  },

  leaveQueue(riderId: string, establishmentId: string): QueueEntry[] {
    const todayStr = this.getOperationalDateString();
    const queue = this.getQueue();
    const nowISO = new Date().toISOString();

    const canonicalUser = this.resolveUser(riderId);
    const actualRiderId = canonicalUser?.id || riderId;

    const updated = queue.map(q => {
      const isSameDay = isSameDayString(q.date, todayStr) || (q.joinedAt && isSameDayString(q.joinedAt, todayStr));
      if (isSameDay) {
        const isSameRider = this.isSameUser(q.riderId, actualRiderId);
        const isSameEst = this.isSameEstablishment(q.establishmentId, establishmentId);

        if (isSameRider && isSameEst && q.status === 'waiting') {
          return { ...q, status: 'left' as const, updatedAt: nowISO };
        }
      }
      return q;
    });

    this.setQueue(updated);

    if (!isTableMissing('rider_queue')) {
      Promise.resolve(
        supabase.from('rider_queue')
          .update({ status: 'left', updated_at: nowISO })
          .eq('rider_id', actualRiderId)
          .eq('establishment_id', establishmentId)
          .eq('status', 'waiting')
      ).catch(() => {});
    }

    return updated;
  },

  reorderQueue(establishmentId: string, orderedEntryIds: string[]) {
    const queue = this.getQueue();
    const nowMs = Date.now();
    const baseTime = nowMs - (orderedEntryIds.length * 1000);

    const idOrderMap = new Map<string, number>();
    orderedEntryIds.forEach((id, index) => idOrderMap.set(id, index));

    const updated = queue.map(q => {
      if (idOrderMap.has(q.id)) {
        const idx = idOrderMap.get(q.id)!;
        const newJoinedAt = new Date(baseTime + (idx * 1000)).toISOString();
        return {
          ...q,
          joinedAt: newJoinedAt,
          updatedAt: new Date().toISOString()
        };
      }
      return q;
    });

    this.setQueue(updated);
  },

  markRiderDelivering(riderId: string, establishmentId: string) {
    const todayStr = this.getOperationalDateString();
    const queue = this.getQueue();
    const nowISO = new Date().toISOString();

    const canonicalUser = this.resolveUser(riderId);
    const actualRiderId = canonicalUser?.id || riderId;

    const updated = queue.map(q => {
      const isSameDay = isSameDayString(q.date, todayStr) || (q.joinedAt && isSameDayString(q.joinedAt, todayStr));
      if (isSameDay && q.status === 'waiting') {
        const isSameRider = this.isSameUser(q.riderId, actualRiderId);
        const isSameEst = this.isSameEstablishment(q.establishmentId, establishmentId);

        if (isSameRider && isSameEst) {
          return { ...q, status: 'delivering' as const, updatedAt: nowISO };
        }
      }
      return q;
    });

    this.setQueue(updated);

    if (!isTableMissing('rider_queue')) {
      Promise.resolve(
        supabase.from('rider_queue')
          .update({ status: 'delivering', updated_at: nowISO })
          .eq('rider_id', actualRiderId)
          .eq('establishment_id', establishmentId)
          .eq('status', 'waiting')
      ).catch(() => {});
    }
  },

  getCurrentUser(): User | null {
    const data = localStorage.getItem(KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },
  setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  },

  startRiderSession() {
    localStorage.setItem(KEYS.SESSION_LOGIN_TIME, new Date().toISOString());
    localStorage.setItem(KEYS.SESSION_DELIVERY_COUNT, '0');
  },

  getRiderSessionHours(): number {
    const loginTimeStr = localStorage.getItem(KEYS.SESSION_LOGIN_TIME);
    if (!loginTimeStr) return 0;
    const loginTime = new Date(loginTimeStr).getTime();
    return (Date.now() - loginTime) / (1000 * 60 * 60);
  },

  getSessionDeliveryCount(): number {
    return parseInt(localStorage.getItem(KEYS.SESSION_DELIVERY_COUNT) || '0', 10);
  },

  incrementSessionDeliveryCount() {
    const current = this.getSessionDeliveryCount();
    localStorage.setItem(KEYS.SESSION_DELIVERY_COUNT, String(current + 1));
  },

  clearRiderSession() {
    localStorage.removeItem(KEYS.SESSION_LOGIN_TIME);
    localStorage.removeItem(KEYS.SESSION_DELIVERY_COUNT);
  },

  checkSessionRequirement(): { allowed: boolean; reason?: string; sessionHours: number; deliveryCount: number } {
    const sessionHours = this.getRiderSessionHours();
    const deliveryCount = this.getSessionDeliveryCount();
    const block = Math.floor(deliveryCount / 2);
    const requiredHours = block * 2;

    if (sessionHours < requiredHours) {
      const remainingMinutes = Math.ceil((requiredHours - sessionHours) * 60);
      return {
        allowed: false,
        reason: `Você precisa ficar logado por mais ${remainingMinutes} minuto(s) para lançar esta corrida. Mantenha o sistema aberto.`,
        sessionHours,
        deliveryCount
      };
    }
    return { allowed: true, sessionHours, deliveryCount };
  },

  PRESENCE_REQUIRED_MS: 30 * 60 * 1000,   // 30 min
  ABSENCE_TOLERANCE_MS: 10 * 60 * 1000,   // 10 min de ausência contínua

  getDeliveryPresenceMap(): Record<string, {
    accumulatedMs: number;
    foregroundSince: string | null;
    absenceStartedAt: string | null;
  }> {
    const raw = localStorage.getItem(KEYS.DELIVERY_PRESENCE);
    return raw ? JSON.parse(raw) : {};
  },

  setDeliveryPresenceMap(map: Record<string, {
    accumulatedMs: number;
    foregroundSince: string | null;
    absenceStartedAt: string | null;
  }>) {
    localStorage.setItem(KEYS.DELIVERY_PRESENCE, JSON.stringify(map));
  },

  startDeliveryPresence(deliveryId: string) {
    const map = this.getDeliveryPresenceMap();
    if (!map[deliveryId]) {
      map[deliveryId] = {
        accumulatedMs: 0,
        foregroundSince: new Date().toISOString(),
        absenceStartedAt: null,
      };
      this.setDeliveryPresenceMap(map);
    }
  },

  pauseAllPresence() {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();
    const map = this.getDeliveryPresenceMap();
    let changed = false;
    Object.keys(map).forEach(id => {
      const e = map[id];
      if (e.foregroundSince !== null) {
        e.accumulatedMs += now - new Date(e.foregroundSince).getTime();
        e.foregroundSince = null;
        e.absenceStartedAt = nowISO;
        changed = true;
      }
    });
    if (changed) this.setDeliveryPresenceMap(map);
  },

  resumeAllPresence() {
    const nowISO = new Date().toISOString();
    const map = this.getDeliveryPresenceMap();
    let changed = false;
    Object.keys(map).forEach(id => {
      const e = map[id];
      if (e.foregroundSince === null) {
        e.foregroundSince = nowISO;
        e.absenceStartedAt = null;
        changed = true;
      }
    });
    if (changed) this.setDeliveryPresenceMap(map);
  },

  getPresenceMs(deliveryId: string): number {
    const map = this.getDeliveryPresenceMap();
    const e = map[deliveryId];
    if (!e) return 0;
    let total = e.accumulatedMs;
    if (e.foregroundSince !== null) {
      total += Date.now() - new Date(e.foregroundSince).getTime();
    }
    return total;
  },

  getCurrentAbsenceMs(deliveryId: string): number {
    const map = this.getDeliveryPresenceMap();
    const e = map[deliveryId];
    if (!e || !e.absenceStartedAt) return 0;
    return Date.now() - new Date(e.absenceStartedAt).getTime();
  },

  isInBackground(deliveryId: string): boolean {
    const map = this.getDeliveryPresenceMap();
    const e = map[deliveryId];
    return !!e && e.foregroundSince === null;
  },

  removeDeliveryPresence(deliveryId: string) {
    const map = this.getDeliveryPresenceMap();
    delete map[deliveryId];
    this.setDeliveryPresenceMap(map);
  },

  getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Retorna a data operacional: se for entre 00:00 e 03:59 da madrugada,
  // recua para a data do dia anterior para pertencer à escala/expediente noturno que começou na véspera.
  getOperationalDateString(date: Date = new Date()): string {
    const d = new Date(date);
    if (d.getHours() < 4) {
      d.setDate(d.getDate() - 1);
    }
    return this.getLocalDateString(d);
  },

  resolveUser(id: string): User | undefined {
    if (!id) return undefined;
    const users = this.getUsers();
    const found = users.find(u => u.id === id);
    if (found) return found;

    const cleanId = id.toLowerCase().trim();
    return users.find(u => 
      (u.email && u.email.toLowerCase().trim() === cleanId) ||
      (u.name && (
        u.name.toLowerCase().trim() === cleanId ||
        u.name.toLowerCase().trim().includes(cleanId) ||
        cleanId.includes(u.name.toLowerCase().trim())
      ))
    );
  },

  resolveEstablishment(id: string): Establishment | undefined {
    if (!id) return undefined;
    const ests = this.getEstablishments();
    const found = ests.find(e => e.id === id);
    if (found) return found;

    const cleanId = id.toLowerCase().trim();
    return ests.find(e => 
      e.name && (
        e.name.toLowerCase().trim() === cleanId ||
        e.name.toLowerCase().trim().includes(cleanId) ||
        cleanId.includes(e.name.toLowerCase().trim())
      )
    );
  },

  isSameEstablishment(id1?: string, id2?: string): boolean {
    if (!id1 || !id2) return false;
    if (id1 === id2) return true;
    const e1 = this.resolveEstablishment(id1);
    const e2 = this.resolveEstablishment(id2);
    if (e1 && e2) {
      return e1.id === e2.id;
    }
    return id1.toLowerCase().trim() === id2.toLowerCase().trim();
  },

  isSameUser(id1?: string, id2?: string): boolean {
    if (!id1 || !id2) return false;
    if (id1 === id2) return true;
    const u1 = this.resolveUser(id1);
    const u2 = this.resolveUser(id2);
    if (u1 && u2) {
      if (u1.id === u2.id) return true;
      if (u1.email && u2.email && u1.email.toLowerCase() === u2.email.toLowerCase()) return true;
      if (u1.cpf && u2.cpf && u1.cpf === u2.cpf) return true;
    }
    return id1.toLowerCase().trim() === id2.toLowerCase().trim();
  },

  generateUniqueDummyCpf(): string {
    const rand = () => Math.floor(Math.random() * 10);
    return `000.000.000-${rand()}${rand()}`;
  },

  async deleteUser(id: string) {
    const users = this.getUsers().filter(u => u.id !== id);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    await supabase.from('users').delete().eq('id', id);
  },

  async deleteEstablishment(id: string) {
    const ests = this.getEstablishments().filter(e => e.id !== id);
    localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(ests));
    await supabase.from('establishments').delete().eq('id', id);
  },

  async deleteSchedule(id: string) {
    const schedules = this.getSchedules().filter(s => s.id !== id);
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(schedules));
    await supabase.from('schedules').delete().eq('id', id);
  },

  async deletePartnerRequest(id: string) {
    const requests = this.getPartnerRequests().filter(r => r.id !== id);
    localStorage.setItem(KEYS.PARTNER_REQUESTS, JSON.stringify(requests));
    await supabase.from('partner_requests').delete().eq('id', id);
  },

  async deleteDelivery(id: string) {
    const deliveries = this.getDeliveries().filter(d => d.id !== id);
    localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(deliveries));
    await supabase.from('deliveries').delete().eq('id', id);
  },

  updateRiderLocation(riderId: string, riderName: string, lat: number, lng: number) {
    const locations = this.getRiderLocationsRecord();
    const updated = {
      ...locations,
      [riderId]: {
        riderId,
        riderName,
        lat,
        lng,
        updatedAt: new Date().toISOString()
      }
    };
    localStorage.setItem(KEYS.RIDER_LOCATIONS, JSON.stringify(updated));
    
    const rawPayload = {
      rider_id: riderId,
      rider_name: riderName,
      lat: lat,
      lng: lng,
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString()
    };

    safeUpsert('rider_locations', rawPayload);
  },

  async clearRiderLocation(riderId: string) {
    realtimeGps.sendOffline(riderId);

    const locations = this.getRiderLocationsRecord();
    if (locations[riderId]) {
      delete locations[riderId];
      localStorage.setItem(KEYS.RIDER_LOCATIONS, JSON.stringify(locations));
    }
    
    if (!isTableMissing('rider_locations')) {
      await supabase.from('rider_locations').delete().eq('rider_id', riderId);
    }
  },

  getRiderLocationsRecord(): Record<string, RiderLocation> {
    const data = localStorage.getItem(KEYS.RIDER_LOCATIONS);
    return data ? JSON.parse(data) : {};
  },

  getRiderLocations(): RiderLocation[] {
    return Object.values(this.getRiderLocationsRecord());
  },

  async pullFromSupabase() {
    try {
      const { data: usersData, error } = await supabase.from('users').select('*');
      if (error) throw error;
      if (usersData) {
        const localUsers = this.getUsers();
        const mappedUsers: User[] = usersData.map(u => {
          const local = localUsers.find(l => l.id === u.id);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            active: u.active,
            createdAt: u.created_at,
            phone: u.phone || local?.phone || '',
            cpf: u.cpf || local?.cpf || '',
            passwordHash: u.password_hash || local?.passwordHash || '',
            mustResetPassword: u.must_reset_password !== undefined ? u.must_reset_password : (local?.mustResetPassword || false),
            establishmentId: u.establishment_id || local?.establishmentId || undefined,
            updatedAt: u.updated_at
          };
        });
        localStorage.setItem(KEYS.USERS, JSON.stringify(mappedUsers));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "users":', err);
    }

    try {
      const { data: estsData, error } = await supabase.from('establishments').select('*');
      if (error) throw error;
      if (estsData) {
        const localEsts = this.getEstablishments();
        const mappedEsts: Establishment[] = estsData.map(e => {
          let parsedAddress = { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' };
          
          if (e.street || e.neighborhood || e.city) {
            parsedAddress = {
              street: e.street || '',
              number: e.number || '',
              complement: e.complement || '',
              neighborhood: e.neighborhood || '',
              city: e.city || '',
              state: e.state || '',
              zipCode: e.zip_code || e.zipCode || ''
            };
          } else if (e.address) {
            if (typeof e.address === 'object') {
              parsedAddress = { ...parsedAddress, ...e.address };
            } else if (typeof e.address === 'string') {
              try {
                let temp = JSON.parse(e.address);
                if (typeof temp === 'string') temp = JSON.parse(temp);
                if (temp && typeof temp === 'object') parsedAddress = { ...parsedAddress, ...temp };
              } catch (err) {}
            }
          }

          const local = localEsts.find(l => l.id === e.id);
          if (isAddressEmptyOrPlaceholder(parsedAddress) && local && local.address && !isAddressEmptyOrPlaceholder(local.address)) {
            parsedAddress = { ...local.address };
          }

          return {
            id: e.id,
            name: e.name,
            email: e.email || local?.email,
            active: e.active,
            phone: e.phone || local?.phone || '',
            address: parsedAddress,
            createdAt: e.created_at,
            updatedAt: e.updated_at
          };
        });
        localStorage.setItem(KEYS.ESTABLISHMENTS, JSON.stringify(mappedEsts));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "establishments":', err);
    }

    try {
      const { data: schData, error } = await supabase.from('schedules').select('*');
      if (error) throw error;
      if (schData) {
        const localSchedules = this.getSchedules();
        const uniqueMap = new Map<string, Schedule>();
        
        schData.forEach(s => {
          const key = `${s.rider_id}_${s.establishment_id}_${s.date}_${s.shift}`;
          const local = localSchedules.find(l => l.id === s.id);
          
          let chat = s.chat || undefined;
          let createdBy = s.created_by || undefined;

          if (s.created_by && s.created_by.startsWith('{')) {
            try {
              const parsed = JSON.parse(s.created_by);
              createdBy = parsed.createdBy || undefined;
              if (parsed.chat) {
                chat = mergeChatStrings(chat, parsed.chat);
              }
            } catch (e) {}
          }

          const mapped: Schedule = {
            id: s.id,
            riderId: s.rider_id,
            establishmentId: s.establishment_id,
            date: s.date,
            shift: s.shift,
            startTime: s.start_time,
            endTime: s.end_time,
            chat: mergeChatStrings(local?.chat, chat),
            createdBy,
            createdAt: s.created_at,
            updatedAt: s.updated_at
          };

          const existing = uniqueMap.get(key);
          if (!existing || parseTimestamp(mapped.updatedAt) > parseTimestamp(existing.updatedAt)) {
            uniqueMap.set(key, mapped);
          }
        });

        localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(Array.from(uniqueMap.values())));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "schedules":', err);
    }

    try {
      const { data: delData, error } = await supabase.from('deliveries').select('*');
      if (error) throw error;
      if (delData) {
        const localDeliveries = this.getDeliveries();
        const mappedDeliveries: Delivery[] = delData.map(d => {
          const local = localDeliveries.find(l => l.id === d.id);
          
          let orderNumber = d.order_number || undefined;
          let notes = d.notes || undefined;
          let customerChat = d.customer_chat || undefined;
          let updatedAt = d.updated_at;

          if (d.order_number && d.order_number.startsWith('{')) {
            try {
              const parsed = JSON.parse(d.order_number);
              orderNumber = parsed.orderNumber || undefined;
              if (parsed.notes) notes = mergeChatStrings(notes, parsed.notes);
              if (parsed.customerChat) customerChat = mergeChatStrings(customerChat, parsed.customerChat);
              updatedAt = parsed.updatedAt || d.updated_at;
            } catch (e) {}
          }

          let finalStatus: 'pending' | 'active' | 'rejected' | 'cancelled' = d.status;
          if (local) {
            const isRemoteResolved = ['active', 'rejected', 'cancelled'].includes(d.status);
            const isLocalResolved = ['active', 'rejected', 'cancelled'].includes(local.status);

            if (isRemoteResolved && local.status === 'pending') {
              finalStatus = d.status;
            } else if (!isRemoteResolved && isLocalResolved) {
              finalStatus = local.status;
            } else {
              const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
              const remoteTime = updatedAt ? new Date(updatedAt).getTime() : 0;
              finalStatus = localTime > remoteTime ? local.status : d.status;
            }
          }

          return {
            id: d.id,
            riderId: d.rider_id,
            establishmentId: d.establishment_id,
            date: d.date,
            time: d.time,
            value: Number(d.value),
            status: finalStatus,
            scheduleId: d.schedule_id || undefined,
            orderNumber,
            notes: mergeChatStrings(local?.notes, notes),
            customerChat: mergeChatStrings(local?.customerChat, customerChat),
            updatedAt,
            paid: d.paid || false
          };
        });
        localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(mappedDeliveries));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "deliveries":', err);
    }

    if (!isTableMissing('rider_queue')) {
      try {
        const { data: queueData, error } = await supabase.from('rider_queue').select('*');
        if (error) {
          if (error.code === 'PGRST205' || (error as any).status === 404) {
            markTableMissing('rider_queue');
          } else {
            throw error;
          }
        } else if (queueData) {
          const localQueue = this.getQueue();
          const remoteQueue: QueueEntry[] = queueData.map(q => ({
            id: q.id,
            riderId: q.rider_id,
            establishmentId: q.establishment_id,
            date: q.date,
            joinedAt: q.joined_at,
            status: q.status,
            updatedAt: q.updated_at
          }));

          const mergedList = this.sanitizeQueue([...localQueue, ...remoteQueue]);
          localStorage.setItem(KEYS.RIDER_QUEUE, JSON.stringify(mergedList));
          window.dispatchEvent(new Event('queue-updated'));
        }
      } catch (err: any) {
        if (err?.code === 'PGRST205' || err?.status === 404) {
          markTableMissing('rider_queue');
        }
      }
    }

    try {
      const { data: reqsData, error } = await supabase.from('partner_requests').select('*');
      if (error) throw error;
      if (reqsData) {
        const mappedReqs: PartnerRequest[] = reqsData.map(r => ({
          id: r.id,
          establishmentName: r.establishment_name,
          ownerName: r.ownerName,
          phone: r.phone,
          address: r.address,
          status: r.status,
          createdAt: r.created_at
        }));
        localStorage.setItem(KEYS.PARTNER_REQUESTS, JSON.stringify(mappedReqs));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "partner_requests":', err);
    }

    try {
      const { data: locData, error } = await supabase.from('rider_locations').select('*');
      if (error) throw error;
      if (locData) {
        const mappedLocs: Record<string, RiderLocation> = {};
        locData.forEach(l => {
          const rId = l.rider_id || l.riderId;
          if (rId) {
            mappedLocs[rId] = {
              riderId: rId,
              riderName: l.rider_name || l.riderName || '',
              lat: parseFloat(l.latitude !== undefined ? l.latitude : l.lat),
              lng: parseFloat(l.longitude !== undefined ? l.longitude : l.lng),
              updatedAt: l.updated_at || l.updatedAt || new Date().toISOString()
            };
          }
        });
        localStorage.setItem(KEYS.RIDER_LOCATIONS, JSON.stringify(mappedLocs));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "rider_locations":', err);
    }

    window.dispatchEvent(new Event('db-sync-complete'));
  }
};