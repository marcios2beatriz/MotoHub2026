"use client";

import { supabase } from './supabase';
import { realtimeGps } from './realtimeGps';

export { supabase };

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
  deliveryType?: 'standard' | 'same_address';
  additionalValue?: number;
  additionalReason?: string;
  linkedOrderNumber?: string;
  linkedDeliveryId?: string;
  paymentMethod?: PaymentMethodType;
  orderCollectionAmount?: number;
  changeFor?: number;
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

export interface Product {
  id: string;
  establishmentId: string;
  name: string;
  sku?: string;
  category?: string;
  unit?: string;
  minStock: number;
  currentStock: number;
  costPrice: number;
  salePrice: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: string;
  establishmentId: string;
  productId: string;
  productName?: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  costPrice?: number;
  createdBy?: string;
  createdAt?: string;
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

const SESSION_USER_KEY = 'motohub_session_user';

// Limpa qualquer cache antigo de entregas que possa estar poluindo o navegador
try {
  localStorage.removeItem('motohub_deliveries_master_v9');
  localStorage.removeItem('motohub_deliveries_master_v8');
  localStorage.removeItem('motohub_deleted_deliveries_ids_v2');
} catch {}

function extractOrderNumberSafe(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const val = parsed.o || parsed.orderNumber || parsed.num || parsed.number;
      if (val) return String(val).replace('#', '').trim();
    } catch {}
  }

  return trimmed.replace('#', '').trim();
}

function parseDeliveryRow(d: any): Delivery {
  let orderNumber: string | undefined = extractOrderNumberSafe(d.order_number);
  let notes: string | undefined = undefined;
  let customerChat: string | undefined = undefined;
  let deliveryType: 'standard' | 'same_address' = Number(d.value) === 4 ? 'same_address' : 'standard';
  let additionalValue: number = 0;
  let additionalReason: string | undefined = undefined;
  let linkedOrderNumber: string | undefined = undefined;
  let paymentMethod: PaymentMethodType = 'already_paid';
  let orderCollectionAmount: number | undefined = undefined;
  let changeFor: number | undefined = undefined;
  let paid = Boolean(d.paid);

  if (d.order_number && String(d.order_number).startsWith('{')) {
    try {
      const parsed = JSON.parse(d.order_number);
      if (parsed.o || parsed.orderNumber) orderNumber = String(parsed.o || parsed.orderNumber).replace('#', '').trim();
      if (parsed.n || parsed.notes) notes = parsed.n || parsed.notes;
      if (parsed.c || parsed.customerChat) customerChat = parsed.c || parsed.customerChat;
      if (parsed.t || parsed.deliveryType) deliveryType = parsed.t === 'm' || parsed.deliveryType === 'same_address' ? 'same_address' : 'standard';
      if (parsed.a !== undefined || parsed.additionalValue !== undefined) additionalValue = Number(parsed.a ?? parsed.additionalValue ?? 0);
      if (parsed.r || parsed.additionalReason) additionalReason = parsed.r || parsed.additionalReason;
      if (parsed.l || parsed.linkedOrderNumber) linkedOrderNumber = String(parsed.l || parsed.linkedOrderNumber).replace('#', '').trim();
      if (parsed.pm) paymentMethod = parsed.pm as PaymentMethodType;
      if (parsed.ca !== undefined) orderCollectionAmount = Number(parsed.ca);
      if (parsed.cf !== undefined) changeFor = Number(parsed.cf);
      if (parsed.p === 1 || parsed.p === true) paid = true;
    } catch (e) {}
  }

  if (Number(d.value) === 4 || linkedOrderNumber) {
    deliveryType = 'same_address';
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
    paymentMethod,
    orderCollectionAmount,
    changeFor,
    updatedAt: d.updated_at,
    paid
  };
}

function formatDeliveryPayload(d: Delivery) {
  const cleanOrderNum = d.orderNumber ? String(d.orderNumber).replace('#', '').trim() : '';

  const isSame = d.deliveryType === 'same_address' || Number(d.value) === 4 || Boolean(d.linkedOrderNumber);
  const pMethod = d.paymentMethod || 'already_paid';

  const hasExtra = d.notes || d.customerChat || isSame || d.additionalValue || d.additionalReason || d.linkedOrderNumber || (pMethod !== 'already_paid') || d.orderCollectionAmount || d.changeFor || d.paid;

  let serializedOrderNum: string | null = cleanOrderNum || null;

  if (hasExtra) {
    const meta: any = {};
    if (cleanOrderNum) meta.o = cleanOrderNum;
    if (d.notes) meta.n = d.notes;
    if (d.customerChat) meta.c = d.customerChat;
    if (isSame) meta.t = 'm';
    if (d.additionalValue) meta.a = d.additionalValue;
    if (d.additionalReason) meta.r = d.additionalReason;
    if (d.linkedOrderNumber) meta.l = d.linkedOrderNumber;
    if (pMethod && pMethod !== 'already_paid') meta.pm = pMethod;
    if (d.orderCollectionAmount) meta.ca = d.orderCollectionAmount;
    if (d.changeFor) meta.cf = d.changeFor;
    if (d.paid) meta.p = 1;

    serializedOrderNum = JSON.stringify(meta);
  }

  return {
    id: d.id,
    rider_id: d.riderId,
    establishment_id: d.establishmentId,
    date: d.date,
    time: d.time,
    value: Number(d.value),
    status: d.status,
    schedule_id: d.scheduleId || null,
    order_number: serializedOrderNum
  };
}

function parseProductRow(p: any): Product {
  return {
    id: p.id,
    establishmentId: p.establishment_id,
    name: p.name,
    sku: p.sku || undefined,
    category: p.category || 'Geral',
    unit: p.unit || 'UN',
    minStock: Number(p.min_stock || 0),
    currentStock: Number(p.current_stock || 0),
    costPrice: Number(p.cost_price || 0),
    salePrice: Number(p.sale_price || 0),
    createdAt: p.created_at,
    updatedAt: p.updated_at
  };
}

function parseStockMovementRow(m: any): StockMovement {
  return {
    id: m.id,
    establishmentId: m.establishment_id,
    productId: m.product_id,
    productName: m.product_name || undefined,
    type: m.type,
    quantity: Number(m.quantity || 0),
    previousStock: Number(m.previous_stock || 0),
    newStock: Number(m.new_stock || 0),
    reason: m.reason || undefined,
    costPrice: Number(m.cost_price || 0),
    createdBy: m.created_by || undefined,
    createdAt: m.created_at
  };
}

// Memória local volátil em runtime (sincronizada com Supabase)
let memoryUsers: User[] = [];
let memoryEstablishments: Establishment[] = [];
let memorySchedules: Schedule[] = [];
let memoryDeliveries: Delivery[] = [];
let memoryNotifications: Notification[] = [];
let memoryRequests: PartnerRequest[] = [];
let memoryLocations: Record<string, RiderLocation> = {};
let memoryRouteHistory: RouteHistoryItem[] = [];
let memoryProducts: Product[] = [];
let memoryStockMovements: StockMovement[] = [];

const inFlightOrderLocks = new Set<string>();

// Throttle para pullFromSupabase — evita chamadas paralelas excessivas
let lastPullTs = 0;
const PULL_THROTTLE_MS = 20000; // máximo 1 pull a cada 20 segundos

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

    // Otimização: Filtrar PRIMEIRO por data para reduzir iterações
    const todayDeliveries = memoryDeliveries.filter(d => {
      if (d.status === 'cancelled' || d.status === 'rejected') return false;
      const dOpDate = getDeliveryOperationalDate(d.date, d.time);
      return isSameDayString(dOpDate, targetOpDate) || isSameDayString(d.date, date);
    });

    // Buscar apenas nas entregas do dia (muito mais rápido)
    const duplicate = todayDeliveries.find(d => {
      if (excludeDeliveryId && d.id === excludeDeliveryId) return false;
      const dNumber = (d.orderNumber || '').trim().replace('#', '');
      return dNumber && dNumber === cleanNumber;
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

  getSchedules(): Schedule[] {
    return memorySchedules;
  },

  async setSchedules(schedules: Schedule[]) {
    memorySchedules = schedules;
    
    const payload = schedules.map(s => {
      const canonicalRider = this.resolveUser(s.riderId);
      const canonicalEst = this.resolveEstablishment(s.establishmentId);

      const serializedCreatedBy = JSON.stringify({
        createdBy: s.createdBy || '',
        chat: s.chat || '',
        updatedAt: s.updatedAt || new Date().toISOString()
      });

      return {
        id: s.id,
        rider_id: canonicalRider?.id || s.riderId,
        establishment_id: canonicalEst?.id || s.establishmentId,
        date: s.date,
        shift: s.shift,
        start_time: s.startTime,
        end_time: s.endTime,
        created_by: serializedCreatedBy
      };
    });

    if (payload.length > 0) {
      await supabase.from('schedules').upsert(payload, { onConflict: 'id' });
    }
    await this.pullFromSupabase();
  },

  async deleteSchedule(id: string) {
    memorySchedules = memorySchedules.filter(s => s.id !== id);
    await supabase.from('schedules').delete().eq('id', id);
    await this.pullFromSupabase();
  },

  getDeliveries(): Delivery[] {
    return memoryDeliveries;
  },

  async setDeliveries(deliveries: Delivery[]) {
    const normalized = deliveries.map(d => {
      const canonicalRider = this.resolveUser(d.riderId);
      const canonicalEst = this.resolveEstablishment(d.establishmentId);
      const isSame = d.deliveryType === 'same_address' || Number(d.value) === 4 || Boolean(d.linkedOrderNumber);

      return {
        ...d,
        riderId: canonicalRider?.id || d.riderId,
        establishmentId: canonicalEst?.id || d.establishmentId,
        deliveryType: isSame ? ('same_address' as const) : ('standard' as const),
        paymentMethod: d.paymentMethod || 'already_paid'
      };
    });

    memoryDeliveries = normalized;

    const payload = normalized.map(formatDeliveryPayload);

    if (payload.length > 0) {
      try {
        const chunkSize = 100;
        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize);
          await supabase.from('deliveries').upsert(chunk, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('Aviso no envio de entregas ao Supabase:', err);
      }
    }

    window.dispatchEvent(new Event('db-sync-complete'));
  },

  // Função otimizada para adicionar UMA ÚNICA corrida (muito mais rápida)
  async addSingleDelivery(delivery: Delivery): Promise<void> {
    const canonicalRider = this.resolveUser(delivery.riderId);
    const canonicalEst = this.resolveEstablishment(delivery.establishmentId);
    const isSame = delivery.deliveryType === 'same_address' || Number(delivery.value) === 4 || Boolean(delivery.linkedOrderNumber);

    const normalized: Delivery = {
      ...delivery,
      riderId: canonicalRider?.id || delivery.riderId,
      establishmentId: canonicalEst?.id || delivery.establishmentId,
      deliveryType: isSame ? ('same_address' as const) : ('standard' as const),
      paymentMethod: delivery.paymentMethod || 'already_paid'
    };

    // Atualiza memória local instantaneamente
    memoryDeliveries = [normalized, ...memoryDeliveries];

    // Insere apenas 1 registro no Supabase (muito mais rápido)
    const payload = formatDeliveryPayload(normalized);
    try {
      await supabase.from('deliveries').insert(payload);
    } catch (err) {
      console.warn('Erro ao inserir corrida no Supabase:', err);
      // Remove da memória se falhou no banco
      memoryDeliveries = memoryDeliveries.filter(d => d.id !== delivery.id);
      throw err;
    }

    window.dispatchEvent(new Event('db-sync-complete'));
  },

  // Função otimizada para editar UMA ÚNICA corrida
  async updateSingleDelivery(deliveryId: string, updates: Partial<Delivery>): Promise<void> {
    const existingIdx = memoryDeliveries.findIndex(d => d.id === deliveryId);
    if (existingIdx === -1) throw new Error('Corrida não encontrada');

    const existing = memoryDeliveries[existingIdx];
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };

    const canonicalRider = this.resolveUser(updated.riderId);
    const canonicalEst = this.resolveEstablishment(updated.establishmentId);
    const isSame = updated.deliveryType === 'same_address' || Number(updated.value) === 4 || Boolean(updated.linkedOrderNumber);

    const normalized: Delivery = {
      ...updated,
      riderId: canonicalRider?.id || updated.riderId,
      establishmentId: canonicalEst?.id || updated.establishmentId,
      deliveryType: isSame ? ('same_address' as const) : ('standard' as const),
      paymentMethod: updated.paymentMethod || 'already_paid'
    };

    // Atualiza memória local instantaneamente
    memoryDeliveries[existingIdx] = normalized;

    // Atualiza apenas 1 registro no Supabase
    const payload = formatDeliveryPayload(normalized);
    try {
      await supabase.from('deliveries').update(payload).eq('id', deliveryId);
    } catch (err) {
      console.warn('Erro ao atualizar corrida no Supabase:', err);
      // Reverte a memória se falhou no banco
      memoryDeliveries[existingIdx] = existing;
      throw err;
    }

    window.dispatchEvent(new Event('db-sync-complete'));
  },

  // Função otimizada para atualizar múltiplas corridas com BATCH UPDATE
  async updateMultipleDeliveries(updates: Array<{ id: string; changes: Partial<Delivery> }>): Promise<void> {
    const updatedDeliveries: Delivery[] = [];
    const originalDeliveries: { index: number; delivery: Delivery }[] = [];

    // Preparar todas as atualizações
    for (const update of updates) {
      const existingIdx = memoryDeliveries.findIndex(d => d.id === update.id);
      if (existingIdx === -1) continue;

      const existing = memoryDeliveries[existingIdx];
      originalDeliveries.push({ index: existingIdx, delivery: existing });

      const updated = { ...existing, ...update.changes, updatedAt: new Date().toISOString() };
      const canonicalRider = this.resolveUser(updated.riderId);
      const canonicalEst = this.resolveEstablishment(updated.establishmentId);
      const isSame = updated.deliveryType === 'same_address' || Number(updated.value) === 4 || Boolean(updated.linkedOrderNumber);

      const normalized: Delivery = {
        ...updated,
        riderId: canonicalRider?.id || updated.riderId,
        establishmentId: canonicalEst?.id || updated.establishmentId,
        deliveryType: isSame ? ('same_address' as const) : ('standard' as const),
        paymentMethod: updated.paymentMethod || 'already_paid'
      };

      memoryDeliveries[existingIdx] = normalized;
      updatedDeliveries.push(normalized);
    }

    // Batch update no Supabase
    try {
      const payloads = updatedDeliveries.map(formatDeliveryPayload);
      await supabase.from('deliveries').upsert(payloads, { onConflict: 'id' });
    } catch (err) {
      console.warn('Erro no batch update:', err);
      // Reverte todas as mudanças na memória
      for (const original of originalDeliveries) {
        memoryDeliveries[original.index] = original.delivery;
      }
      throw err;
    }

    window.dispatchEvent(new Event('db-sync-complete'));
  },

  // Função otimizada para adicionar múltiplas corridas (batch insert)
  async addMultipleDeliveries(deliveries: Delivery[]): Promise<void> {
    const normalized = deliveries.map(d => {
      const canonicalRider = this.resolveUser(d.riderId);
      const canonicalEst = this.resolveEstablishment(d.establishmentId);
      const isSame = d.deliveryType === 'same_address' || Number(d.value) === 4 || Boolean(d.linkedOrderNumber);

      return {
        ...d,
        riderId: canonicalRider?.id || d.riderId,
        establishmentId: canonicalEst?.id || d.establishmentId,
        deliveryType: isSame ? ('same_address' as const) : ('standard' as const),
        paymentMethod: d.paymentMethod || 'already_paid'
      };
    });

    // Atualiza memória local instantaneamente
    memoryDeliveries = [...normalized, ...memoryDeliveries];

    // Batch insert no Supabase
    try {
      const payloads = normalized.map(formatDeliveryPayload);
      await supabase.from('deliveries').insert(payloads);
    } catch (err) {
      console.warn('Erro no batch insert:', err);
      // Remove da memória se falhou no banco
      const idsToRemove = new Set(deliveries.map(d => d.id));
      memoryDeliveries = memoryDeliveries.filter(d => !idsToRemove.has(d.id));
      throw err;
    }

    window.dispatchEvent(new Event('db-sync-complete'));
  },

  async deleteDelivery(id: string): Promise<boolean> {
    if (!id) return false;
    memoryDeliveries = memoryDeliveries.filter(d => d.id !== id);

    try {
      const { error } = await supabase.from('deliveries').delete().eq('id', id);
      if (error) {
        console.error('Erro ao deletar entrega no Supabase:', error);
        throw error;
      }
    } catch (e: any) {
      console.error('Erro ao deletar entrega no Supabase:', e);
      throw e;
    }

    window.dispatchEvent(new Event('db-sync-complete'));
    return true;
  },

  // Apaga todas as duplicatas com o mesmo número de pedido na mesma data, mantendo apenas 1 registro único
  async removeDuplicateDeliveries(establishmentId?: string): Promise<number> {
    const all = memoryDeliveries;
    const seen = new Set<string>();
    const idsToDelete: string[] = [];

    all.forEach(d => {
      if (establishmentId && !this.isSameEstablishment(d.establishmentId, establishmentId)) return;
      const num = (d.orderNumber || '').trim().replace('#', '');
      if (!num) return;
      
      const opDate = getDeliveryOperationalDate(d.date, d.time);
      const key = `${opDate}_${num}_${d.riderId}`;

      if (seen.has(key)) {
        idsToDelete.push(d.id);
      } else {
        seen.add(key);
      }
    });

    if (idsToDelete.length > 0) {
      memoryDeliveries = memoryDeliveries.filter(d => !idsToDelete.includes(d.id));
      for (const id of idsToDelete) {
        await supabase.from('deliveries').delete().eq('id', id);
      }
      window.dispatchEvent(new Event('db-sync-complete'));
    }

    return idsToDelete.length;
  },

  async clearAllDeliveries() {
    memoryDeliveries = [];
    try {
      await supabase.from('deliveries').delete().neq('id', '');
    } catch (e) {}

    window.dispatchEvent(new Event('db-sync-complete'));
  },

  getNotifications(): Notification[] {
    return memoryNotifications;
  },

  async setNotifications(notifications: Notification[]) {
    memoryNotifications = notifications;
    const payload = notifications.map(n => ({
      id: n.id,
      rider_id: this.resolveUser(n.riderId)?.id || n.riderId,
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

  getProducts(establishmentId?: string): Product[] {
    if (!establishmentId) return memoryProducts;
    return memoryProducts.filter(p => this.isSameEstablishment(p.establishmentId, establishmentId));
  },

  async saveProduct(product: Product): Promise<void> {
    const existingIdx = memoryProducts.findIndex(p => p.id === product.id);
    const nowStr = new Date().toISOString();
    const updatedProd: Product = {
      ...product,
      updatedAt: nowStr,
      createdAt: product.createdAt || nowStr
    };

    if (existingIdx >= 0) {
      memoryProducts[existingIdx] = updatedProd;
    } else {
      memoryProducts.push(updatedProd);
    }

    try {
      await supabase.from('products').upsert({
        id: updatedProd.id,
        establishment_id: updatedProd.establishmentId,
        name: updatedProd.name,
        sku: updatedProd.sku || null,
        category: updatedProd.category || 'Geral',
        unit: updatedProd.unit || 'UN',
        min_stock: updatedProd.minStock,
        current_stock: updatedProd.currentStock,
        cost_price: updatedProd.costPrice,
        sale_price: updatedProd.salePrice,
        updated_at: updatedProd.updatedAt,
        created_at: updatedProd.createdAt
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('Erro ao salvar produto no Supabase:', err);
    }

    window.dispatchEvent(new Event('db-sync-complete'));
  },

  async deleteProduct(id: string): Promise<void> {
    memoryProducts = memoryProducts.filter(p => p.id !== id);
    try {
      await supabase.from('products').delete().eq('id', id);
      await supabase.from('stock_movements').delete().eq('product_id', id);
    } catch (err) {
      console.warn('Erro ao excluir produto no Supabase:', err);
    }
    window.dispatchEvent(new Event('db-sync-complete'));
  },

  getStockMovements(establishmentId?: string, productId?: string): StockMovement[] {
    return memoryStockMovements.filter(m => {
      if (establishmentId && !this.isSameEstablishment(m.establishmentId, establishmentId)) return false;
      if (productId && m.productId !== productId) return false;
      return true;
    });
  },

  async addStockMovement(movement: Omit<StockMovement, 'id' | 'createdAt'>): Promise<StockMovement> {
    const id = 'sm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const nowStr = new Date().toISOString();
    const product = memoryProducts.find(p => p.id === movement.productId);
    const prevStock = product ? Number(product.currentStock || 0) : movement.previousStock;
    let newStock = prevStock;

    if (movement.type === 'in') {
      newStock = prevStock + Number(movement.quantity);
    } else if (movement.type === 'out') {
      newStock = Math.max(0, prevStock - Number(movement.quantity));
    } else {
      newStock = Number(movement.newStock ?? movement.quantity);
    }

    const newMov: StockMovement = {
      id,
      establishmentId: movement.establishmentId,
      productId: movement.productId,
      productName: product?.name || movement.productName,
      type: movement.type,
      quantity: Number(movement.quantity),
      previousStock: prevStock,
      newStock: newStock,
      reason: movement.reason,
      costPrice: movement.costPrice ?? product?.costPrice,
      createdBy: movement.createdBy,
      createdAt: nowStr
    };

    memoryStockMovements = [newMov, ...memoryStockMovements];

    if (product) {
      product.currentStock = newStock;
      product.updatedAt = nowStr;
      if (movement.type === 'in' && movement.costPrice && movement.costPrice > 0) {
        product.costPrice = movement.costPrice;
      }
      try {
        await supabase.from('products').update({
          current_stock: newStock,
          cost_price: product.costPrice,
          updated_at: nowStr
        }).eq('id', product.id);
      } catch (err) {
        console.warn('Erro ao atualizar estoque do produto no Supabase:', err);
      }
    }

    try {
      await supabase.from('stock_movements').insert({
        id: newMov.id,
        establishment_id: newMov.establishmentId,
        product_id: newMov.productId,
        type: newMov.type,
        quantity: newMov.quantity,
        previous_stock: newMov.previousStock,
        new_stock: newMov.newStock,
        reason: newMov.reason || null,
        cost_price: newMov.costPrice || 0,
        created_by: newMov.createdBy || null,
        created_at: newMov.createdAt
      });
    } catch (err) {
      console.warn('Erro ao salvar movimentação de estoque no Supabase:', err);
    }

    window.dispatchEvent(new Event('db-sync-complete'));
    return newMov;
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

    const canonicalId = this.resolveUser(riderId)?.id || riderId;
    const updatedAt = new Date().toISOString();
    memoryLocations[canonicalId] = { riderId: canonicalId, riderName, lat, lng, updatedAt };

    try {
      await supabase.from('rider_locations').upsert({
        rider_id: canonicalId,
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
    const canonicalId = this.resolveUser(riderId)?.id || riderId;
    realtimeGps.sendOffline(canonicalId);
    delete memoryLocations[canonicalId];
    try {
      await supabase.from('rider_locations').delete().eq('rider_id', canonicalId);
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
    const direct = memoryUsers.find(u => u.id === id);
    if (direct) return direct;

    const clean = id.toLowerCase().trim();
    const cleanDigits = clean.replace(/\D/g, '');

    return memoryUsers.find(u => {
      if (u.id && u.id.toLowerCase().trim() === clean) return true;
      if (u.email && u.email.toLowerCase().trim() === clean) return true;
      if (u.name && u.name.toLowerCase().trim() === clean) return true;
      if (cleanDigits.length >= 8) {
        if (u.cpf && u.cpf.replace(/\D/g, '') === cleanDigits) return true;
        if (u.phone && u.phone.replace(/\D/g, '') === cleanDigits) return true;
      }
      return false;
    });
  },

  resolveEstablishment(id: string): Establishment | undefined {
    if (!id) return undefined;
    const direct = memoryEstablishments.find(e => e.id === id);
    if (direct) return direct;

    const clean = id.toLowerCase().trim();
    return memoryEstablishments.find(e => 
      (e.id && e.id.toLowerCase().trim() === clean) ||
      (e.name && e.name.toLowerCase().trim() === clean) ||
      (e.email && e.email.toLowerCase().trim() === clean)
    );
  },

  isSameEstablishment(id1?: string, id2?: string): boolean {
    if (!id1 || !id2) return false;
    if (id1 === id2) return true;
    const clean1 = id1.toLowerCase().trim();
    const clean2 = id2.toLowerCase().trim();
    if (clean1 === clean2) return true;

    const e1 = this.resolveEstablishment(id1);
    const e2 = this.resolveEstablishment(id2);
    if (e1 && e2) return e1.id === e2.id;
    return false;
  },

  isSameUser(id1?: string, id2?: string): boolean {
    if (!id1 || !id2) return false;
    if (id1 === id2) return true;
    const clean1 = id1.toLowerCase().trim();
    const clean2 = id2.toLowerCase().trim();
    if (clean1 === clean2) return true;

    const u1 = this.resolveUser(id1);
    const u2 = this.resolveUser(id2);
    if (u1 && u2) {
      if (u1.id === u2.id) return true;
      if (u1.email && u2.email && u1.email.toLowerCase().trim() === u2.email.toLowerCase().trim()) return true;
      const cpf1 = u1.cpf ? u1.cpf.replace(/\D/g, '') : '';
      const cpf2 = u2.cpf ? u2.cpf.replace(/\D/g, '') : '';
      if (cpf1 && cpf2 && cpf1 === cpf2) return true;
    }
    return false;
  },

  generateUniqueDummyCpf(): string {
    const rand = () => Math.floor(Math.random() * 10);
    return `000.000.000-${rand()}${rand()}`;
  },

  async syncLocalToSupabase(): Promise<{ deliveriesCount: number }> {
    await this.pullFromSupabase();
    return { deliveriesCount: memoryDeliveries.length };
  },

  async pullFromSupabase() {
    // EMERGÊNCIA: Removendo throttle temporariamente para forçar recarga completa dos dados
    // const now = Date.now();
    // if (now - lastPullTs < PULL_THROTTLE_MS) {
    //   return;
    // }
    // lastPullTs = now;

    console.log('🔄 EMERGÊNCIA: Forçando recarga COMPLETA dos dados do Supabase...');

    try {
      // Otimização: usar SELECT * temporariamente até identificar campos problemáticos
      const { data: usersData } = await supabase
        .from('users')
        .select('*'); // Voltar ao SELECT * que funcionava
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

      const { data: estsData } = await supabase
        .from('establishments')
        .select('*'); // Voltar ao SELECT * que funcionava
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

      const { data: schData } = await supabase
        .from('schedules')
        .select('*')
        .order('date', { ascending: false }); // SELECT * + ordenação
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

          const cRider = this.resolveUser(s.rider_id);
          const cEst = this.resolveEstablishment(s.establishment_id);

          return {
            id: s.id,
            riderId: cRider?.id || s.rider_id,
            establishmentId: cEst?.id || s.establishment_id,
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

      // Puxar entregas com paginação otimizada
      const allDelData: any[] = [];
      let delFrom = 0;
      const delBatchSize = 500; // reduzido de 1000 para 500
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('deliveries')
          .select('*')
          .range(delFrom, delFrom + delBatchSize - 1)
          .order('date', { ascending: false }); // SELECT * + ordenação por data

        if (error || !data || data.length === 0) {
          hasMore = false;
          break;
        }

        allDelData.push(...data);
        if (data.length < delBatchSize) {
          hasMore = false;
        } else {
          delFrom += delBatchSize;
        }

        // Remover limite máximo - carregar TODAS as entregas
      }

      if (allDelData.length > 0) {
        memoryDeliveries = allDelData.map(parseDeliveryRow);
      } else {
        memoryDeliveries = [];
      }

      const { data: reqsData } = await supabase
        .from('partner_requests')
        .select('*'); // SELECT * 
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

      const { data: locData } = await supabase
        .from('rider_locations')
        .select('*'); // SELECT *
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

      // Puxar produtos do estoque
      const { data: prodsData } = await supabase
        .from('products')
        .select('*'); // SELECT *
      if (prodsData) {
        memoryProducts = prodsData.map(parseProductRow);
      }

      // Puxar histórico de movimentações de estoque (TODAS as movimentações)
      const { data: movsData } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false }); // SELECT * + ordenação
      if (movsData) {
        memoryStockMovements = movsData.map(parseStockMovementRow);
      }

      window.dispatchEvent(new Event('db-sync-complete'));
      
      console.log('✅ DADOS CARREGADOS:', {
        usuarios: memoryUsers.length,
        estabelecimentos: memoryEstablishments.length, 
        escalas: memorySchedules.length,
        entregas: memoryDeliveries.length,
        produtos: memoryProducts.length,
        movimentacoes: memoryStockMovements.length
      });
    } catch (err) {
      console.error('🚨 ERRO ao carregar dados do Supabase:', err);
    }
  }
};

// Escuta em tempo real todas as alterações (INSERT, UPDATE, DELETE) na tabela deliveries do Supabase
try {
  supabase
    .channel('public:deliveries')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) {
          memoryDeliveries = memoryDeliveries.filter(d => d.id !== deletedId);
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      } else if (payload.eventType === 'INSERT') {
        if (payload.new && payload.new.id) {
          const parsed = parseDeliveryRow(payload.new);
          if (!memoryDeliveries.some(d => d.id === parsed.id)) {
            memoryDeliveries = [parsed, ...memoryDeliveries];
            window.dispatchEvent(new Event('db-sync-complete'));
          }
        }
      } else if (payload.eventType === 'UPDATE') {
        if (payload.new && payload.new.id) {
          const parsed = parseDeliveryRow(payload.new);
          memoryDeliveries = memoryDeliveries.map(d => d.id === parsed.id ? parsed : d);
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      }
    })
    .subscribe();

  supabase
    .channel('public:products')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) {
          memoryProducts = memoryProducts.filter(p => p.id !== deletedId);
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (payload.new && payload.new.id) {
          const parsed = parseProductRow(payload.new);
          const idx = memoryProducts.findIndex(p => p.id === parsed.id);
          if (idx >= 0) {
            memoryProducts[idx] = parsed;
          } else {
            memoryProducts.push(parsed);
          }
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      }
    })
    .subscribe();

  supabase
    .channel('public:stock_movements')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        if (payload.new && payload.new.id) {
          const parsed = parseStockMovementRow(payload.new);
          if (!memoryStockMovements.some(m => m.id === parsed.id)) {
            memoryStockMovements = [parsed, ...memoryStockMovements];
            window.dispatchEvent(new Event('db-sync-complete'));
          }
        }
      }
    })
    .subscribe();

  // Canais realtime para reduzir polling das demais tabelas
  supabase
    .channel('public:users')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) {
          memoryUsers = memoryUsers.filter(u => u.id !== deletedId);
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (payload.new && payload.new.id) {
          const newUser: User = {
            id: payload.new.id,
            name: payload.new.name,
            email: payload.new.email,
            role: payload.new.role,
            active: payload.new.active ?? true,
            phone: payload.new.phone || '',
            cpf: payload.new.cpf || '',
            passwordHash: payload.new.password_hash || '',
            mustResetPassword: payload.new.must_reset_password || false,
            establishmentId: payload.new.establishment_id || undefined,
            createdAt: payload.new.created_at,
            updatedAt: payload.new.updated_at
          };
          const idx = memoryUsers.findIndex(u => u.id === newUser.id);
          if (idx >= 0) {
            memoryUsers[idx] = newUser;
          } else {
            memoryUsers.push(newUser);
          }
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      }
    })
    .subscribe();

  supabase
    .channel('public:establishments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'establishments' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) {
          memoryEstablishments = memoryEstablishments.filter(e => e.id !== deletedId);
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (payload.new && payload.new.id) {
          const newEst: Establishment = {
            id: payload.new.id,
            name: payload.new.name,
            email: payload.new.email || undefined,
            active: payload.new.active ?? true,
            phone: payload.new.phone || '',
            address: {
              street: payload.new.street || '',
              number: payload.new.number || '',
              complement: payload.new.complement || '',
              neighborhood: payload.new.neighborhood || '',
              city: payload.new.city || '',
              state: payload.new.state || '',
              zipCode: payload.new.zip_code || ''
            },
            createdAt: payload.new.created_at,
            updatedAt: payload.new.updated_at
          };
          const idx = memoryEstablishments.findIndex(e => e.id === newEst.id);
          if (idx >= 0) {
            memoryEstablishments[idx] = newEst;
          } else {
            memoryEstablishments.push(newEst);
          }
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      }
    })
    .subscribe();

  supabase
    .channel('public:schedules')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) {
          memorySchedules = memorySchedules.filter(s => s.id !== deletedId);
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (payload.new && payload.new.id) {
          let chat: string | undefined = undefined;
          let createdBy: string | undefined = undefined;
          if (payload.new.created_by && payload.new.created_by.startsWith('{')) {
            try {
              const parsed = JSON.parse(payload.new.created_by);
              createdBy = parsed.createdBy || undefined;
              chat = parsed.chat || undefined;
            } catch (e) {}
          } else {
            createdBy = payload.new.created_by || undefined;
          }

          const newSchedule: Schedule = {
            id: payload.new.id,
            riderId: payload.new.rider_id,
            establishmentId: payload.new.establishment_id,
            date: payload.new.date,
            shift: payload.new.shift,
            startTime: payload.new.start_time,
            endTime: payload.new.end_time,
            chat,
            createdBy,
            createdAt: payload.new.created_at,
            updatedAt: payload.new.updated_at
          };
          const idx = memorySchedules.findIndex(s => s.id === newSchedule.id);
          if (idx >= 0) {
            memorySchedules[idx] = newSchedule;
          } else {
            memorySchedules.push(newSchedule);
          }
          window.dispatchEvent(new Event('db-sync-complete'));
        }
      }
    })
    .subscribe();
} catch (err) {
  console.warn('Supabase Realtime Channel error:', err);
}

db.pullFromSupabase();