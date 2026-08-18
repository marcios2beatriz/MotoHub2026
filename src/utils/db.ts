"use client";

import { createClient } from '@supabase/supabase-js';
import { realtimeGps } from './realtimeGps';

// Configuração oficial do cliente Supabase
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
  chat?: string;
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
  notes?: string;
  customerChat?: string;
  updatedAt?: string;
  paid?: boolean;
  lostAt?: string;
  lostReason?: string;
  // Campos de Vinculação e Valores Adicionais com Justificativa
  deliveryType?: 'standard' | 'same_address';
  additionalValue?: number;
  additionalReason?: string;
  linkedOrderNumber?: string;
  linkedDeliveryId?: string;
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
  date: string;
  time: string;
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

export function isSameDayString(d1?: string, d2?: string): boolean {
  if (!d1 || !d2) return false;
  const clean1 = d1.split('T')[0].split(' ')[0].trim();
  const clean2 = d2.split('T')[0].split(' ')[0].trim();
  return clean1 === clean2;
}

export function getDeliveryOperationalDate(dateStr: string, timeStr: string = '12:00'): string {
  if (!dateStr) return '';
  const cleanDate = dateStr.split('T')[0].split(' ')[0].trim();
  const [hStr] = (timeStr || '12:00').split(':');
  const h = parseInt(hStr, 10);

  if (!isNaN(h) && h < 3) {
    const [y, m, d] = cleanDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    const prevY = dateObj.getFullYear();
    const prevM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const prevD = String(dateObj.getDate()).padStart(2, '0');
    return `${prevY}-${prevM}-${prevD}`;
  }

  return cleanDate;
}

// Chave unicamente para persistir a sessão de login no navegador
const SESSION_USER_KEY = 'motohub_session_user';

// Cache em memória de tempo de execução sincronizado com o Supabase
let memoryUsers: User[] = [];
let memoryEstablishments: Establishment[] = [];
let memorySchedules: Schedule[] = [];
let memoryDeliveries: Delivery[] = [];
let memoryNotifications: Notification[] = [];
let memoryRequests: PartnerRequest[] = [];
let memoryLocations: Record<string, RiderLocation> = {};
let memoryRouteHistory: RouteHistoryItem[] = [];

export const db = {
  isSameDayString,
  getDeliveryOperationalDate,

  // Verifica se o número do pedido já foi lançado no mesmo dia operacional por qualquer motoboy
  checkDuplicateOrderNumber(orderNumber: string, date: string, time: string = '12:00', excludeDeliveryId?: string): { isDuplicate: boolean; duplicateDelivery?: Delivery; riderName?: string } {
    const cleanNumber = orderNumber.trim().replace('#', '');
    if (!cleanNumber) return { isDuplicate: false };

    const targetOpDate = getDeliveryOperationalDate(date, time);

    const duplicate = memoryDeliveries.find(d => {
      if (excludeDeliveryId && d.id === excludeDeliveryId) return false;
      if (d.status === 'cancelled') return false;

      const dNumber = (d.orderNumber || '').trim().replace('#', '');
      if (!dNumber || dNumber !== cleanNumber) return false;

      const dOpDate = getDeliveryOperationalDate(d.date, d.time);
      return isSameDayString(dOpDate, targetOpDate);
    });

    if (duplicate) {
      const rider = this.resolveUser(duplicate.riderId);
      return {
        isDuplicate: true,
        duplicateDelivery: duplicate,
        riderName: rider?.name || 'Outro entregador'
      };
    }

    return { isDuplicate: false };
  },

  // Retorna pedidos já lançados no mesmo dia para facilitar a vinculação
  getAvailableDeliveriesForLinking(date: string, time: string = '12:00', riderId?: string): Delivery[] {
    const targetOpDate = getDeliveryOperationalDate(date, time);
    return memoryDeliveries.filter(d => {
      if (d.status === 'cancelled' || d.status === 'rejected') return false;
      if (riderId && d.riderId !== riderId) return false;
      const dOpDate = getDeliveryOperationalDate(d.date, d.time);
      return isSameDayString(dOpDate, targetOpDate);
    });
  },

  // --- SESSÃO DO USUÁRIO ATIVO ---
  getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(SESSION_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_USER_KEY);
    }
  },

  // --- USUÁRIOS ---
  getUsers(): User[] {
    return memoryUsers;
  },

  async setUsers(users: User[]) {
    memoryUsers = users;
    const payload = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email.toLowerCase().trim(),
      role: u.role,
      active: u.active,
      phone: u.phone,
      cpf: u.cpf,
      password_hash: u.passwordHash,
      must_reset_password: u.mustResetPassword || false,
      establishment_id: u.establishmentId || null
    }));

    if (payload.length > 0) {
      await supabase.from('users').upsert(payload, { onConflict: 'id' });
    }
    await this.pullFromSupabase();
  },

  async fetchUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.trim().toLowerCase();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (!error && data) {
      const user: User = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        active: data.active ?? true,
        phone: data.phone || '',
        cpf: data.cpf || '',
        passwordHash: data.password_hash || '',
        mustResetPassword: data.must_reset_password || false,
        establishmentId: data.establishment_id || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      const existingIdx = memoryUsers.findIndex(u => u.id === user.id);
      if (existingIdx >= 0) {
        memoryUsers[existingIdx] = user;
      } else {
        memoryUsers.push(user);
      }

      return user;
    }

    if (cleanEmail === 'admin@delivery.com') {
      const adminDefault: User = {
        id: 'u_admin_default',
        name: 'Administrador Geral',
        email: 'admin@delivery.com',
        role: 'admin',
        active: true,
        phone: '(83) 99999-9999',
        cpf: '000.000.000-01',
        passwordHash: 'D24180417c*'
      };

      await supabase.from('users').upsert({
        id: adminDefault.id,
        name: adminDefault.name,
        email: adminDefault.email,
        role: adminDefault.role,
        active: adminDefault.active,
        phone: adminDefault.phone,
        cpf: adminDefault.cpf,
        password_hash: adminDefault.passwordHash
      }, { onConflict: 'id' });

      return adminDefault;
    }

    return null;
  },

  async deleteUser(id: string) {
    memoryUsers = memoryUsers.filter(u => u.id !== id);
    await supabase.from('users').delete().eq('id', id);
    await this.pullFromSupabase();
  },

  // --- ESTABELECIMENTOS ---
  getEstablishments(): Establishment[] {
    return memoryEstablishments;
  },

  async setEstablishments(ests: Establishment[]) {
    memoryEstablishments = ests;
    const payload = ests.map(e => ({
      id: e.id,
      name: e.name,
      email: e.email || null,
      active: e.active,
      phone: e.phone || '',
      street: e.address?.street || '',
      number: e.address?.number || '',
      complement: e.address?.complement || '',
      neighborhood: e.address?.neighborhood || '',
      city: e.address?.city || '',
      state: e.address?.state || '',
      zip_code: e.address?.zipCode || ''
    }));

    if (payload.length > 0) {
      await supabase.from('establishments').upsert(payload, { onConflict: 'id' });
    }
    await this.pullFromSupabase();
  },

  async deleteEstablishment(id: string) {
    memoryEstablishments = memoryEstablishments.filter(e => e.id !== id);
    await supabase.from('establishments').delete().eq('id', id);
    await this.pullFromSupabase();
  },

  // --- ESCALAS ---
  getSchedules(): Schedule[] {
    return memorySchedules;
  },

  async setSchedules(schedules: Schedule[]) {
    memorySchedules = schedules;
    
    const payload = schedules.map(s => {
      const serializedCreatedBy = JSON.stringify({
        createdBy: s.createdBy || '',
        chat: s.chat || '',
        updatedAt: s.updatedAt || new Date().toISOString()
      });

      return {
        id: s.id,
        rider_id: s.riderId,
        establishment_id: s.establishmentId,
        date: s.date,
        shift: s.shift,
        start_time: s.startTime,
        end_time: s.endTime,
        created_by: serializedCreatedBy
      };
    });

    if (payload.length > 0) {
      const { error } = await supabase.from('schedules').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('Erro ao gravar escalas no Supabase:', error);
      }
    }
    await this.pullFromSupabase();
  },

  async deleteSchedule(id: string) {
    memorySchedules = memorySchedules.filter(s => s.id !== id);
    await supabase.from('schedules').delete().eq('id', id);
    await this.pullFromSupabase();
  },

  // --- CORRIDAS (SUPORTE COMPLETO A VINCULAÇÃO, ADICIONAIS E JUSTIFICATIVA) ---
  getDeliveries(): Delivery[] {
    return memoryDeliveries;
  },

  async setDeliveries(deliveries: Delivery[]) {
    memoryDeliveries = deliveries;
    const payload = deliveries.map(d => {
      // Cria payload ultra-compacto para nunca estourar o limite de varchar(255) da coluna order_number
      const compactMeta: any = {};
      if (d.orderNumber) compactMeta.o = d.orderNumber;
      if (d.notes) compactMeta.n = d.notes.slice(0, 100);
      if (d.customerChat) compactMeta.c = d.customerChat.slice(-100);
      if (d.deliveryType && d.deliveryType !== 'standard') compactMeta.t = 'm';
      if (d.additionalValue && Number(d.additionalValue) > 0) compactMeta.a = Number(d.additionalValue);
      if (d.additionalReason) compactMeta.r = d.additionalReason.slice(0, 40);
      if (d.linkedOrderNumber) compactMeta.l = d.linkedOrderNumber.slice(0, 10);

      let serializedOrderNumber = Object.keys(compactMeta).length > 0 
        ? JSON.stringify(compactMeta) 
        : (d.orderNumber || '');

      if (serializedOrderNumber.length > 250) {
        serializedOrderNumber = serializedOrderNumber.slice(0, 250);
      }

      return {
        id: d.id,
        rider_id: d.riderId,
        establishment_id: d.establishmentId,
        date: d.date,
        time: d.time,
        value: d.value,
        status: d.status,
        schedule_id: d.scheduleId || null,
        order_number: serializedOrderNumber
      };
    });

    if (payload.length > 0) {
      const { error } = await supabase.from('deliveries').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('Erro ao gravar entregas no Supabase:', error);
      }
    }
    await this.pullFromSupabase();
  },

  async deleteDelivery(id: string) {
    memoryDeliveries = memoryDeliveries.filter(d => d.id !== id);
    await supabase.from('deliveries').delete().eq('id', id);
    await this.pullFromSupabase();
  },

  async clearAllDeliveries() {
    memoryDeliveries = [];
    await supabase.from('deliveries').delete().neq('id', '');
    await this.pullFromSupabase();
  },

  // --- NOTIFICAÇÕES ---
  getNotifications(): Notification[] {
    return memoryNotifications;
  },

  async setNotifications(notifications: Notification[]) {
    memoryNotifications = notifications;
    const payload = notifications.map(n => ({
      id: n.id,
      rider_id: n.riderId,
      title: n.title,
      message: n.message,
      date: n.date,
      read: n.read
    }));

    if (payload.length > 0) {
      await supabase.from('notifications').upsert(payload, { onConflict: 'id' });
    }
    await this.pullFromSupabase();
  },

  // --- SOLICITAÇÕES DE PARCERIA ---
  getPartnerRequests(): PartnerRequest[] {
    return memoryRequests;
  },

  async setPartnerRequests(requests: PartnerRequest[]) {
    memoryRequests = requests;
    const payload = requests.map(r => ({
      id: r.id,
      establishment_name: r.establishmentName,
      owner_name: r.ownerName,
      phone: r.phone,
      address: r.address,
      status: r.status,
      created_at: r.createdAt
    }));

    if (payload.length > 0) {
      await supabase.from('partner_requests').upsert(payload, { onConflict: 'id' });
    }
    await this.pullFromSupabase();
  },

  async deletePartnerRequest(id: string) {
    memoryRequests = memoryRequests.filter(r => r.id !== id);
    await supabase.from('partner_requests').delete().eq('id', id);
    await this.pullFromSupabase();
  },

  // --- HISTÓRICO DE ROTAS ---
  getRouteHistory(): RouteHistoryItem[] {
    return memoryRouteHistory;
  },

  setRouteHistory(history: RouteHistoryItem[]) {
    memoryRouteHistory = history;
    window.dispatchEvent(new Event('route-history-updated'));
  },

  addRouteHistory(item: RouteHistoryItem) {
    const exists = memoryRouteHistory.some(c => c.riderId === item.riderId && c.destinationName === item.destinationName && Math.abs(new Date(c.createdAt).getTime() - new Date(item.createdAt).getTime()) < 30000);
    if (!exists) {
      memoryRouteHistory = [item, ...memoryRouteHistory].slice(0, 100);
      window.dispatchEvent(new Event('route-history-updated'));
    }
  },

  // --- LOCALIZAÇÃO GPS DOS MOTOBOYS ---
  getRiderLocations(): RiderLocation[] {
    return Object.values(memoryLocations);
  },

  getRiderLocationsRecord(): Record<string, RiderLocation> {
    return memoryLocations;
  },

  async updateRiderLocation(riderId: string, riderName: string, lat: number, lng: number) {
    if (!riderId || !lat || !lng || isNaN(lat) || isNaN(lng)) return;

    const updatedAt = new Date().toISOString();
    memoryLocations[riderId] = { riderId, riderName, lat, lng, updatedAt };

    try {
      await supabase.from('rider_locations').upsert({
        rider_id: riderId,
        rider_name: riderName,
        lat: lat,
        lng: lng,
        updated_at: updatedAt
      }, { onConflict: 'rider_id' });
    } catch (e) {
      console.warn('Erro ao atualizar rider_locations:', e);
    }
  },

  async clearRiderLocation(riderId: string) {
    realtimeGps.sendOffline(riderId);
    delete memoryLocations[riderId];
    try {
      await supabase.from('rider_locations').delete().eq('rider_id', riderId);
    } catch (e) {}
  },

  // --- RESOLVERS & HELPERS ---
  getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getOperationalDateString(date: Date = new Date()): string {
    return this.getLocalDateString(date);
  },

  getShiftOperationalDate(calendarDateStr: string, _timeStr: string): string {
    return calendarDateStr || this.getLocalDateString();
  },

  resolveUser(id: string): User | undefined {
    if (!id) return undefined;
    const found = memoryUsers.find(u => u.id === id);
    if (found) return found;

    const cleanId = id.toLowerCase().trim();
    return memoryUsers.find(u => 
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
    const found = memoryEstablishments.find(e => e.id === id);
    if (found) return found;

    const cleanId = id.toLowerCase().trim();
    return memoryEstablishments.find(e => 
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
    if (e1 && e2) return e1.id === e2.id;
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

  // --- SINCRONIZAÇÃO TOTAL EXCLUSIVA COM O SUPABASE ---
  async pullFromSupabase() {
    try {
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData) {
        memoryUsers = usersData.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active ?? true,
          phone: u.phone || '',
          cpf: u.cpf || '',
          passwordHash: u.password_hash || '',
          mustResetPassword: u.must_reset_password || false,
          establishmentId: u.establishment_id || undefined,
          createdAt: u.created_at,
          updatedAt: u.updated_at
        }));
      }

      const { data: estsData } = await supabase.from('establishments').select('*');
      if (estsData) {
        memoryEstablishments = estsData.map(e => ({
          id: e.id,
          name: e.name,
          email: e.email || undefined,
          active: e.active ?? true,
          phone: e.phone || '',
          address: {
            street: e.street || '',
            number: e.number || '',
            complement: e.complement || '',
            neighborhood: e.neighborhood || '',
            city: e.city || '',
            state: e.state || '',
            zipCode: e.zip_code || ''
          },
          createdAt: e.created_at,
          updatedAt: e.updated_at
        }));
      }

      const { data: schData } = await supabase.from('schedules').select('*');
      if (schData) {
        memorySchedules = schData.map(s => {
          let chat: string | undefined = undefined;
          let createdBy: string | undefined = undefined;
          if (s.created_by && s.created_by.startsWith('{')) {
            try {
              const parsed = JSON.parse(s.created_by);
              createdBy = parsed.createdBy || undefined;
              chat = parsed.chat || undefined;
            } catch (e) {}
          } else {
            createdBy = s.created_by || undefined;
          }

          return {
            id: s.id,
            riderId: s.rider_id,
            establishmentId: s.establishment_id,
            date: s.date,
            shift: s.shift,
            startTime: s.start_time,
            endTime: s.end_time,
            chat,
            createdBy,
            createdAt: s.created_at,
            updatedAt: s.updated_at
          };
        });
      }

      const { data: delData } = await supabase.from('deliveries').select('*');
      if (delData) {
        memoryDeliveries = delData.map(d => {
          let orderNumber = d.order_number || undefined;
          let notes: string | undefined = undefined;
          let customerChat: string | undefined = undefined;
          let deliveryType: 'standard' | 'same_address' = 'standard';
          let additionalValue: number = 0;
          let additionalReason: string | undefined = undefined;
          let linkedOrderNumber: string | undefined = undefined;
          let linkedDeliveryId: string | undefined = undefined;
          let updatedAt = d.updated_at;

          if (d.order_number && d.order_number.startsWith('{')) {
            try {
              const parsed = JSON.parse(d.order_number);
              orderNumber = parsed.orderNumber || parsed.o || undefined;
              notes = parsed.notes || parsed.n || undefined;
              customerChat = parsed.customerChat || parsed.c || undefined;
              deliveryType = parsed.deliveryType || (parsed.t === 'm' ? 'same_address' : 'standard') || 'standard';
              additionalValue = Number(parsed.additionalValue || parsed.a || 0);
              additionalReason = parsed.additionalReason || parsed.r || undefined;
              linkedOrderNumber = parsed.linkedOrderNumber || parsed.l || undefined;
              linkedDeliveryId = parsed.linkedDeliveryId || undefined;
              updatedAt = parsed.updatedAt || d.updated_at;
            } catch (e) {}
          }

          return {
            id: d.id,
            riderId: d.rider_id,
            establishmentId: d.establishment_id,
            date: d.date,
            time: d.time,
            value: Number(d.value),
            status: d.status,
            scheduleId: d.schedule_id || undefined,
            orderNumber,
            notes,
            customerChat,
            deliveryType,
            additionalValue,
            additionalReason,
            linkedOrderNumber,
            linkedDeliveryId,
            updatedAt,
            paid: d.paid || false
          };
        });
      }

      const { data: reqsData } = await supabase.from('partner_requests').select('*');
      if (reqsData) {
        memoryRequests = reqsData.map(r => ({
          id: r.id,
          establishmentName: r.establishment_name,
          ownerName: r.owner_name,
          phone: r.phone,
          address: r.address,
          status: r.status,
          createdAt: r.created_at
        }));
      }

      const { data: locData } = await supabase.from('rider_locations').select('*');
      if (locData) {
        const mappedLocs: Record<string, RiderLocation> = {};
        locData.forEach(l => {
          const rId = l.rider_id;
          if (rId && l.lat && l.lng) {
            mappedLocs[rId] = {
              riderId: rId,
              riderName: l.rider_name || '',
              lat: parseFloat(l.lat),
              lng: parseFloat(l.lng),
              updatedAt: l.updated_at || new Date().toISOString()
            };
          }
        });
        memoryLocations = mappedLocs;
      }

      window.dispatchEvent(new Event('db-sync-complete'));
    } catch (err) {
      console.warn('Erro ao consultar Supabase:', err);
    }
  }
};

// Executa a carga inicial diretamente do Supabase
db.pullFromSupabase();