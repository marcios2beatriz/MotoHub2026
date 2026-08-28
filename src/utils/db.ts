"use client";

import { createClient } from '@supabase/supabase-js';
import { realtimeGps } from './realtimeGps';

// Configuração oficial do cliente Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rqieirvzutdculcdsncb.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pjEo4HVVSPTMF-fQDwKpLQ_o9HAIOWR';
export const supabase = createClient(supabaseUrl, supabaseKey);

export type PaymentMethodType = 'already_paid' | 'money' | 'card_debit' | 'card_credit' | 'pix_delivery';

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
  value: number; // Taxa de entrega do motoboy
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
  // Pagamento na Entrega
  paymentMethod?: PaymentMethodType;
  orderCollectionAmount?: number; // Valor total do pedido a cobrar do cliente
  changeFor?: number; // Troco para R$ X (se pagamento em dinheiro)
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
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() - 1);
      const prevY = dateObj.getFullYear();
      const prevM = String(dateObj.getMonth() + 1).padStart(2, '0');
      const prevD = String(dateObj.getDate()).padStart(2, '0');
      return `${prevY}-${prevM}-${prevD}`;
    }
  }

  return cleanDate;
}

// Chaves para persistência local
const SESSION_USER_KEY = 'motohub_session_user';
const DELIVERIES_STORAGE_BACKUP_KEY = 'motohub_deliveries_master_recovery_v4';

// ── EXTRAÇÃO INTELIGENTE E RESILIENTE DE NÚMERO DO PEDIDO ──
function extractOrderNumberDeep(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;

  // 1. Tenta extração via JSON
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.orderNumber) return String(parsed.orderNumber).replace('#', '').trim();
      if (parsed.o) return String(parsed.o).replace('#', '').trim();
      if (parsed.num) return String(parsed.num).replace('#', '').trim();
      if (parsed.number) return String(parsed.number).replace('#', '').trim();
    } catch {}

    // 2. Extração via Regex em JSON truncado ou corrompido
    const regexList = [
      /"(?:o|orderNumber|order_number|num|number)"\s*:\s*"([^"]+)"/i,
      /"(?:o|orderNumber|order_number|num|number)"\s*:\s*(\d{1,8})/i,
      /#(\d{1,6})/
    ];

    for (const reg of regexList) {
      const match = trimmed.match(reg);
      if (match && match[1]) {
        return match[1].replace('#', '').trim();
      }
    }
  }

  // 3. String direta com hashtag ou números (ex: "#1042", "1042", "Pedido 1042")
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    const hashMatch = trimmed.match(/#(\d{1,6})/);
    if (hashMatch && hashMatch[1]) return hashMatch[1];

    const cleanNum = trimmed.replace(/\D/g, '');
    if (cleanNum && cleanNum.length <= 6) return cleanNum;

    return trimmed.replace('#', '').trim();
  }

  return undefined;
}

function saveMasterDeliveriesBackup(dels: Delivery[]) {
  try {
    localStorage.setItem(DELIVERIES_STORAGE_BACKUP_KEY, JSON.stringify(dels));
  } catch {}
}

function loadMasterDeliveriesBackup(): Delivery[] {
  try {
    const data = localStorage.getItem(DELIVERIES_STORAGE_BACKUP_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

// Cache em memória
let memoryUsers: User[] = [];
let memoryEstablishments: Establishment[] = [];
let memorySchedules: Schedule[] = [];
let memoryDeliveries: Delivery[] = loadMasterDeliveriesBackup();
let memoryNotifications: Notification[] = [];
let memoryRequests: PartnerRequest[] = [];
let memoryLocations: Record<string, RiderLocation> = {};
let memoryRouteHistory: RouteHistoryItem[] = [];

const inFlightOrderLocks = new Set<string>();

export const db = {
  isSameDayString,
  getDeliveryOperationalDate,

  lockOrder(orderNumber: string, date: string, time: string = '12:00'): boolean {
    const cleanNumber = orderNumber.trim().replace('#', '');
    if (!cleanNumber) return true;
    const opDate = getDeliveryOperationalDate(date, time);
    const lockKey = `${opDate}_${cleanNumber}`;

    if (inFlightOrderLocks.has(lockKey)) {
      return false;
    }

    inFlightOrderLocks.add(lockKey);
    setTimeout(() => {
      inFlightOrderLocks.delete(lockKey);
    }, 4000);

    return true;
  },

  unlockOrder(orderNumber: string, date: string, time: string = '12:00') {
    const cleanNumber = orderNumber.trim().replace('#', '');
    if (!cleanNumber) return;
    const opDate = getDeliveryOperationalDate(date, time);
    inFlightOrderLocks.delete(`${opDate}_${cleanNumber}`);
  },

  checkDuplicateOrderNumber(orderNumber: string, date: string, time: string = '12:00', excludeDeliveryId?: string): { isDuplicate: boolean; duplicateDelivery?: Delivery; riderName?: string; establishmentName?: string } {
    const cleanNumber = orderNumber.trim().replace('#', '');
    if (!cleanNumber) return { isDuplicate: false };

    const targetOpDate = getDeliveryOperationalDate(date, time);

    const duplicate = memoryDeliveries.find(d => {
      if (excludeDeliveryId && d.id === excludeDeliveryId) return false;
      if (d.status === 'cancelled' || d.status === 'rejected') return false;

      const dNumber = (d.orderNumber || '').trim().replace('#', '');
      if (!dNumber || dNumber !== cleanNumber) return false;

      const dOpDate = getDeliveryOperationalDate(d.date, d.time);
      return isSameDayString(dOpDate, targetOpDate) || isSameDayString(d.date, date);
    });

    if (duplicate) {
      const rider = this.resolveUser(duplicate.riderId);
      const est = this.resolveEstablishment(duplicate.establishmentId);
      return {
        isDuplicate: true,
        duplicateDelivery: duplicate,
        riderName: rider?.name || 'Outro entregador',
        establishmentName: est?.name || 'Estabelecimento'
      };
    }

    return { isDuplicate: false };
  },

  getAvailableDeliveriesForLinking(date: string, time: string = '12:00', riderId?: string): Delivery[] {
    const targetOpDate = getDeliveryOperationalDate(date, time);
    return memoryDeliveries.filter(d => {
      if (d.status === 'cancelled' || d.status === 'rejected') return false;
      if (riderId && !this.isSameUser(d.riderId, riderId)) return false;
      const dOpDate = getDeliveryOperationalDate(d.date, d.time);
      return isSameDayString(dOpDate, targetOpDate) || isSameDayString(d.date, date);
    });
  },

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
      try {
        await supabase.from('users').upsert(payload, { onConflict: 'id' });
      } catch (e) {
        console.warn('Erro ao salvar usuários no Supabase:', e);
      }
    }
    await this.pullFromSupabase();
  },

  async fetchUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.trim().toLowerCase();
    
    try {
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
    } catch (e) {}

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

      try {
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
      } catch (e) {}

      return adminDefault;
    }

    return null;
  },

  async deleteUser(id: string) {
    memoryUsers = memoryUsers.filter(u => u.id !== id);
    try {
      await supabase.from('users').delete().eq('id', id);
    } catch (e) {}
    await this.pullFromSupabase();
  },

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
      try {
        await supabase.from('establishments').upsert(payload, { onConflict: 'id' });
      } catch (e) {
        console.warn('Erro ao salvar estabelecimentos:', e);
      }
    }
    await this.pullFromSupabase();
  },

  async deleteEstablishment(id: string) {
    memoryEstablishments = memoryEstablishments.filter(e => e.id !== id);
    try {
      await supabase.from('establishments').delete().eq('id', id);
    } catch (e) {}
    await this.pullFromSupabase();
  },

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
      try {
        await supabase.from('schedules').upsert(payload, { onConflict: 'id' });
      } catch (e) {
        console.warn('Erro ao salvar escalas no Supabase:', e);
      }
    }
    await this.pullFromSupabase();
  },

  async deleteSchedule(id: string) {
    memorySchedules = memorySchedules.filter(s => s.id !== id);
    try {
      await supabase.from('schedules').delete().eq('id', id);
    } catch (e) {}
    await this.pullFromSupabase();
  },

  // ── GERENCIAMENTO E PERSISTÊNCIA TOTAL DE CORRIDAS ──
  getDeliveries(): Delivery[] {
    return memoryDeliveries;
  },

  async setDeliveries(deliveries: Delivery[]) {
    // 1. Atualiza memória e backup local imediatamente para não perder dados
    memoryDeliveries = deliveries;
    saveMasterDeliveriesBackup(deliveries);

    // 2. Monta payload para o Supabase com compactação segura
    const payload = deliveries.map(d => {
      const cleanOrderNum = d.orderNumber ? String(d.orderNumber).replace('#', '').trim() : '';

      const compactMeta: any = {
        o: cleanOrderNum
      };

      if (d.deliveryType && d.deliveryType !== 'standard') compactMeta.t = 'm';
      if (d.additionalValue && Number(d.additionalValue) > 0) compactMeta.a = Number(d.additionalValue);
      if (d.additionalReason) compactMeta.r = d.additionalReason.slice(0, 40);
      if (d.linkedOrderNumber) compactMeta.l = String(d.linkedOrderNumber).replace('#', '').slice(0, 10);
      if (d.paid) compactMeta.p = 1;
      if (d.notes) compactMeta.n = d.notes.slice(0, 80);
      if (d.paymentMethod && d.paymentMethod !== 'already_paid') compactMeta.pm = d.paymentMethod;
      if (d.orderCollectionAmount && Number(d.orderCollectionAmount) > 0) compactMeta.ca = Number(d.orderCollectionAmount);
      if (d.changeFor && Number(d.changeFor) > 0) compactMeta.cf = Number(d.changeFor);

      const serializedOrderNumber = JSON.stringify(compactMeta);

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
      try {
        const { error: upsertError } = await supabase.from('deliveries').upsert(payload, { onConflict: 'id' });
        if (upsertError) {
          console.warn('Falha no upsert completo de entregas, tentando envio simplificado:', upsertError);
          // Fallback seguro caso haja limite de tamanho na coluna order_number do postgres
          const fallbackPayload = payload.map(p => ({
            ...p,
            order_number: JSON.stringify({ o: extractOrderNumberDeep(p.order_number) || '' })
          }));
          await supabase.from('deliveries').upsert(fallbackPayload, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('Erro de rede ao salvar entregas no Supabase:', err);
      }
    }

    await this.pullFromSupabase();
  },

  async deleteDelivery(id: string) {
    memoryDeliveries = memoryDeliveries.filter(d => d.id !== id);
    saveMasterDeliveriesBackup(memoryDeliveries);
    try {
      await supabase.from('deliveries').delete().eq('id', id);
    } catch (e) {}
    await this.pullFromSupabase();
  },

  async clearAllDeliveries() {
    memoryDeliveries = [];
    saveMasterDeliveriesBackup([]);
    try {
      await supabase.from('deliveries').delete().neq('id', '');
    } catch (e) {}
    await this.pullFromSupabase();
  },

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
      try {
        await supabase.from('notifications').upsert(payload, { onConflict: 'id' });
      } catch (e) {}
    }
    await this.pullFromSupabase();
  },

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
      try {
        await supabase.from('partner_requests').upsert(payload, { onConflict: 'id' });
      } catch (e) {}
    }
    await this.pullFromSupabase();
  },

  async deletePartnerRequest(id: string) {
    memoryRequests = memoryRequests.filter(r => r.id !== id);
    try {
      await supabase.from('partner_requests').delete().eq('id', id);
    } catch (e) {}
    await this.pullFromSupabase();
  },

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
    } catch (e) {}
  },

  async clearRiderLocation(riderId: string) {
    realtimeGps.sendOffline(riderId);
    delete memoryLocations[riderId];
    try {
      await supabase.from('rider_locations').delete().eq('rider_id', riderId);
    } catch (e) {}
  },

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

    const cleanId = String(id).toLowerCase().trim();
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

    const cleanId = String(id).toLowerCase().trim();
    return memoryEstablishments.find(e => 
      (e.id && e.id.toLowerCase().trim() === cleanId) ||
      (e.name && (
        e.name.toLowerCase().trim() === cleanId ||
        e.name.toLowerCase().trim().includes(cleanId) ||
        cleanId.includes(e.name.toLowerCase().trim())
      ))
    );
  },

  isSameEstablishment(id1?: string, id2?: string): boolean {
    if (!id1 || !id2) return false;
    if (id1 === id2) return true;
    const clean1 = String(id1).toLowerCase().trim();
    const clean2 = String(id2).toLowerCase().trim();
    if (clean1 === clean2) return true;

    const e1 = this.resolveEstablishment(id1);
    const e2 = this.resolveEstablishment(id2);
    if (e1 && e2) return e1.id === e2.id;
    if (e1 && e1.id.toLowerCase() === clean2) return true;
    if (e2 && e2.id.toLowerCase() === clean1) return true;

    return false;
  },

  isSameUser(id1?: string, id2?: string): boolean {
    if (!id1 || !id2) return false;
    if (id1 === id2) return true;
    const clean1 = String(id1).toLowerCase().trim();
    const clean2 = String(id2).toLowerCase().trim();
    if (clean1 === clean2) return true;

    const u1 = this.resolveUser(id1);
    const u2 = this.resolveUser(id2);
    if (u1 && u2) {
      if (u1.id === u2.id) return true;
      if (u1.email && u2.email && u1.email.toLowerCase().trim() === u2.email.toLowerCase().trim()) return true;
      if (u1.cpf && u2.cpf && u1.cpf === u2.cpf) return true;
    }
    if (u1 && u1.id.toLowerCase() === clean2) return true;
    if (u2 && u2.id.toLowerCase() === clean1) return true;

    return false;
  },

  generateUniqueDummyCpf(): string {
    const rand = () => Math.floor(Math.random() * 10);
    return `000.000.000-${rand()}${rand()}`;
  },

  // ── SINCRONIZAÇÃO E RESTAURAÇÃO TOTAL DOS DADOS DO SUPABASE ──
  async pullFromSupabase() {
    try {
      const { data: usersData, error: uErr } = await supabase.from('users').select('*');
      if (!uErr && usersData && usersData.length > 0) {
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

      const { data: estsData, error: eErr } = await supabase.from('establishments').select('*');
      if (!eErr && estsData && estsData.length > 0) {
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

      const { data: schData, error: sErr } = await supabase.from('schedules').select('*');
      if (!sErr && schData && schData.length > 0) {
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

      const { data: delData, error: dErr } = await supabase.from('deliveries').select('*');
      if (!dErr && delData) {
        const backupList = loadMasterDeliveriesBackup();
        const existingLocalMap = new Map<string, Delivery>();
        
        backupList.forEach(d => existingLocalMap.set(d.id, d));
        memoryDeliveries.forEach(d => existingLocalMap.set(d.id, d));

        // Mapeamento dos registros vindos do Supabase
        const fetchedDeliveries: Delivery[] = delData.map(d => {
          const localItem = existingLocalMap.get(d.id);

          let orderNumber: string | undefined = extractOrderNumberDeep(d.order_number) || localItem?.orderNumber;
          let notes: string | undefined = localItem?.notes;
          let customerChat: string | undefined = localItem?.customerChat;
          let deliveryType: 'standard' | 'same_address' = localItem?.deliveryType || 'standard';
          let additionalValue: number = localItem?.additionalValue || 0;
          let additionalReason: string | undefined = localItem?.additionalReason;
          let linkedOrderNumber: string | undefined = localItem?.linkedOrderNumber;
          let linkedDeliveryId: string | undefined = localItem?.linkedDeliveryId;
          let paymentMethod: PaymentMethodType = localItem?.paymentMethod || 'already_paid';
          let orderCollectionAmount: number | undefined = localItem?.orderCollectionAmount;
          let changeFor: number | undefined = localItem?.changeFor;
          let updatedAt = d.updated_at || localItem?.updatedAt;
          let paid = Boolean(d.paid || localItem?.paid);

          if (d.order_number && String(d.order_number).startsWith('{')) {
            try {
              const parsed = JSON.parse(d.order_number);
              if (parsed.orderNumber || parsed.o) {
                orderNumber = String(parsed.orderNumber || parsed.o).replace('#', '').trim();
              }
              if (parsed.notes || parsed.n) {
                notes = parsed.notes || parsed.n;
              }
              if (parsed.customerChat || parsed.c) {
                customerChat = parsed.customerChat || parsed.c;
              }
              if (parsed.deliveryType || parsed.t) {
                deliveryType = parsed.deliveryType || (parsed.t === 'm' ? 'same_address' : 'standard');
              }
              if (parsed.additionalValue !== undefined || parsed.a !== undefined) {
                additionalValue = Number(parsed.additionalValue ?? parsed.a ?? 0);
              }
              if (parsed.additionalReason || parsed.r) {
                additionalReason = parsed.additionalReason || parsed.r;
              }
              if (parsed.linkedOrderNumber || parsed.l) {
                linkedOrderNumber = String(parsed.linkedOrderNumber || parsed.l).replace('#', '').trim();
              }
              if (parsed.pm) {
                const validPm: PaymentMethodType[] = ['already_paid', 'money', 'card_debit', 'card_credit', 'pix_delivery'];
                if (validPm.includes(parsed.pm as PaymentMethodType)) {
                  paymentMethod = parsed.pm as PaymentMethodType;
                }
              }
              if (parsed.ca !== undefined) {
                orderCollectionAmount = Number(parsed.ca);
              }
              if (parsed.cf !== undefined) {
                changeFor = Number(parsed.cf);
              }
              if (parsed.p === 1 || parsed.p === true || parsed.paid === true) {
                paid = true;
              }
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
            paymentMethod,
            orderCollectionAmount,
            changeFor,
            updatedAt,
            paid
          };
        });

        // Mescla sem perder corridas locais recém-adicionadas
        const fetchedIdSet = new Set(fetchedDeliveries.map(d => d.id));
        const mergedList = [...fetchedDeliveries];

        existingLocalMap.forEach((localD, localId) => {
          if (!fetchedIdSet.has(localId)) {
            // Se foi adicionada localmente e ainda não desceu do banco, mantém na memória
            mergedList.push(localD);
          }
        });

        memoryDeliveries = mergedList;
        saveMasterDeliveriesBackup(memoryDeliveries);
      }

      const { data: reqsData, error: rErr } = await supabase.from('partner_requests').select('*');
      if (!rErr && reqsData && reqsData.length > 0) {
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

      const { data: locData, error: lErr } = await supabase.from('rider_locations').select('*');
      if (!lErr && locData) {
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