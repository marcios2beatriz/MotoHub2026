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
  date: string; // YYYY-MM-DD (Data do turno operacional)
  shift: 'morning' | 'afternoon' | 'night';
  startTime: string;
  endTime: string;
  chat?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Delivery {
  id: string;
  riderId: string;
  establishmentId: string;
  date: string; // YYYY-MM-DD (Data do turno operacional)
  time: string; // HH:MM
  value: number;
  status: 'pending' | 'active' | 'rejected' | 'cancelled' | 'lost';
  scheduleId?: string;
  orderNumber?: string;
  notes?: string;
  customerChat?: string;
  updatedAt?: string;
  paid?: boolean;
  lostAt?: string;
  lostReason?: string;
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
  createdAt: string;
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
  ROUTE_HISTORY: 'delivery_system_route_history',
  MISSING_COLUMNS: 'delivery_system_missing_columns',
  MISSING_TABLES: 'delivery_system_missing_tables'
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

  getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * REGRA DE TURNO INTELIGENTE POR DATA:
   * Horários entre 00:00 e 02:59 da madrugada pertencem ao turno/expediente iniciado no dia anterior (às 18:00h).
   */
  getOperationalDateString(date: Date = new Date()): string {
    const d = new Date(date);
    const hour = d.getHours();
    const minute = d.getMinutes();
    
    // Se for entre 00:00 e 02:59 da madrugada, o expediente pertence ao dia anterior
    if (hour < 3) {
      d.setDate(d.getDate() - 1);
    }
    return this.getLocalDateString(d);
  },

  /**
   * Converte uma data e horário de corrida para a data do turno operacional correspondente.
   * Se a corrida foi lançada entre 00:00 e 02:59, ela é atribuída ao expediente do dia anterior.
   */
  getShiftOperationalDate(calendarDateStr: string, timeStr: string): string {
    if (!calendarDateStr) return this.getOperationalDateString();
    const [h, m] = (timeStr || '18:00').split(':').map(Number);
    
    // Se for entre 00:00 e 02:59 da madrugada, retrocede 1 dia para o dia do expediente
    if (h >= 0 && h < 3) {
      const [year, month, day] = calendarDateStr.split('-').map(Number);
      const prev = new Date(year, month - 1, day);
      prev.setDate(prev.getDate() - 1);
      return this.getLocalDateString(prev);
    }
    return calendarDateStr;
  },

  // Restaura e recupera todas as corridas que foram marcadas como 'lost' ou de dias recentes
  restoreAllLostDeliveries(): { recoveredCount: number; datesRecovered: string[] } {
    const deliveries = this.getDeliveries();
    let recoveredCount = 0;
    const datesSet = new Set<string>();

    const updated = deliveries.map(d => {
      if (d.status === 'lost' || d.date === '2026-08-15' || d.date === '2024-08-15' || d.date.includes('08-15')) {
        if (d.status === 'lost') {
          recoveredCount++;
          datesSet.add(d.date);
          return {
            ...d,
            status: 'active' as const,
            lostAt: undefined,
            lostReason: undefined,
            updatedAt: new Date().toISOString()
          };
        }
      }
      return d;
    });

    if (recoveredCount > 0) {
      this.setDeliveries(updated);
    }

    return { recoveredCount, datesRecovered: Array.from(datesSet) };
  },

  /**
   * Normaliza e vincula as corridas ao turno correto de 18:00 às 02:59 do dia subsequente.
   */
  normalizeAndLinkHistoricalDeliveries(): { updatedCount: number; linkedSchedulesCount: number } {
    const deliveries = this.getDeliveries();
    const schedules = this.getSchedules();
    let updatedCount = 0;
    let linkedSchedulesCount = 0;

    const updatedDeliveries = deliveries.map(d => {
      let isModified = false;
      let targetDate = d.date;
      let targetScheduleId = d.scheduleId;
      let targetStatus = d.status;

      if (targetStatus === 'lost') {
        targetStatus = 'active';
        isModified = true;
      }

      const [h, m] = (d.time || '12:00').split(':').map(Number);

      // Aplicação do Turno Inteligente: Entre 00:00 e 02:59
      if (h >= 0 && h < 3) {
        // Encontra a escala noturna correspondente
        const [y, month, day] = d.date.split('-').map(Number);
        const prevDay = new Date(y, month - 1, day);
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDayStr = this.getLocalDateString(prevDay);

        const matchingSchedule = schedules.find(s => 
          this.isSameUser(s.riderId, d.riderId) &&
          this.isSameEstablishment(s.establishmentId, d.establishmentId) &&
          (isSameDayString(s.date, prevDayStr) || isSameDayString(s.date, d.date))
        );

        if (matchingSchedule) {
          if (targetDate !== matchingSchedule.date) {
            targetDate = matchingSchedule.date;
            isModified = true;
          }
          if (targetScheduleId !== matchingSchedule.id) {
            targetScheduleId = matchingSchedule.id;
            linkedSchedulesCount++;
            isModified = true;
          }
        }
      } else {
        if (!targetScheduleId) {
          const matchingSchedule = schedules.find(s => 
            this.isSameUser(s.riderId, d.riderId) &&
            this.isSameEstablishment(s.establishmentId, d.establishmentId) &&
            isSameDayString(s.date, d.date)
          );
          if (matchingSchedule) {
            targetScheduleId = matchingSchedule.id;
            linkedSchedulesCount++;
            isModified = true;
          }
        }
      }

      if (isModified) {
        updatedCount++;
        return {
          ...d,
          date: targetDate,
          status: targetStatus,
          scheduleId: targetScheduleId,
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    });

    if (updatedCount > 0) {
      this.setDeliveries(updatedDeliveries);
    }

    return { updatedCount, linkedSchedulesCount };
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

          let finalStatus: 'pending' | 'active' | 'rejected' | 'cancelled' | 'lost' = d.status;
          if (finalStatus === 'lost') {
            finalStatus = 'active';
          }

          if (local) {
            const isRemoteResolved = ['active', 'rejected', 'cancelled'].includes(d.status);
            const isLocalResolved = ['active', 'rejected', 'cancelled'].includes(local.status);

            if (isRemoteResolved && local.status === 'pending') {
              finalStatus = d.status as any;
            } else if (!isRemoteResolved && isLocalResolved) {
              finalStatus = local.status;
            } else {
              const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
              const remoteTime = updatedAt ? new Date(updatedAt).getTime() : 0;
              finalStatus = (localTime > remoteTime ? local.status : d.status) as any;
            }
          }

          if (finalStatus === 'lost') {
            finalStatus = 'active';
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

        const mergedDeliveries = [...mappedDeliveries];
        localDeliveries.forEach(loc => {
          if (!mergedDeliveries.some(m => m.id === loc.id)) {
            mergedDeliveries.push({
              ...loc,
              status: loc.status === 'lost' ? 'active' : loc.status
            });
          }
        });

        localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(mergedDeliveries));
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela "deliveries":', err);
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

    this.restoreAllLostDeliveries();
    this.normalizeAndLinkHistoricalDeliveries();

    window.dispatchEvent(new Event('db-sync-complete'));
  }
};