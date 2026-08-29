"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, Establishment, Schedule, Delivery, PartnerRequest, RiderLocation, getDeliveryOperationalDate, isSameDayString } from '../utils/db';
import { 
  Users, 
  Store, 
  Calendar, 
  CalendarDays, 
  Bike, 
  BarChart3, 
  LogOut, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  Download, 
  Search, 
  Clock, 
  MessageSquare, 
  Building2, 
  TrendingUp, 
  DollarSign, 
  Phone, 
  MapPin, 
  Ban, 
  Filter, 
  ArrowUpDown, 
  UserCheck2, 
  Map as MapIcon, 
  KeyRound, 
  CheckCheck, 
  Maximize2, 
  Minimize2, 
  Eye, 
  EyeOff, 
  LocateFixed, 
  RotateCcw, 
  RotateCw, 
  Sparkles, 
  Layers, 
  Hash, 
  FileText, 
  Percent, 
  Wallet, 
  Coins, 
  Receipt, 
  Link2, 
  Banknote, 
  CreditCard, 
  QrCode, 
  Copy, 
  UploadCloud, 
  Loader2 
} from 'lucide-react';

import L from 'leaflet';
import UserModal from '../components/UserModal';
import EstablishmentModal from '../components/EstablishmentModal';
import ScheduleModal from '../components/ScheduleModal';
import WeeklyScheduleModal from '../components/WeeklyScheduleModal';
import RiderSchedulesModal from '../components/RiderSchedulesModal';
import DeliveryModal from '../components/DeliveryModal';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import BatchDeliveryModal from '../components/BatchDeliveryModal';
import ChatToastBanner, { ChatToast } from '../components/ChatToastBanner';
import RiderFinancialMetricsCard from '../components/RiderFinancialMetricsCard';
import { sendDeviceNotification, playNotificationSound, requestNotificationPermission } from '../utils/notifications';
import { realtimeGps } from '../utils/realtimeGps';

const DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
const DAY_LABELS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

// Taxa padrão do administrador por corrida
const ADMIN_FEE_PER_DELIVERY = 1.00;

// Corridas de mesmo endereço (R$ 4,00) são 100% isentas da taxa administrativa
export const getAdminFeeForDelivery = (d: Delivery): number => {
  const val = Number(d.value || 0);
  if (d.deliveryType === 'same_address' || val <= 4.00) {
    return 0;
  }
  return ADMIN_FEE_PER_DELIVERY;
};

export const getRiderNetForDelivery = (d: Delivery): number => {
  const val = Number(d.value || 0);
  const fee = getAdminFeeForDelivery(d);
  return Math.max(0, val - fee);
};

// Tempo limite para considerar o motoboy online no Admin (3 minutos)
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

export function getShiftLabel(shift: string): string {
  switch(shift) {
    case 'morning': return 'Manhã';
    case 'afternoon': return 'Tarde';
    case 'night': return 'Noite';
    default: return shift || '';
  }
}

const getThisMonday = (): string => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const dateNum = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${dateNum}`;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminUser] = useState(db.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'users' | 'establishments' | 'requests' | 'schedules' | 'deliveries' | 'finance' | 'reports'>('overview');

  const [users, setUsers] = useState<User[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [activeToast, setActiveToast] = useState<ChatToast | null>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'rider' | 'establishment'>('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'contacted'>('all');

  // Filtros de Escalas
  const [schRiderFilter, setSchRiderFilter] = useState<string>('all');
  const [schEstFilter, setSchEstFilter] = useState<string>('all');
  const [schShiftFilter, setSchShiftFilter] = useState<string>('all');
  const [schTimeframeFilter, setSchTimeframeFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [schSpecificDate, setSchSpecificDate] = useState<string>('');
  const [schSortOrder, setSchSortOrder] = useState<'date_desc' | 'date_asc' | 'rider_name' | 'est_name'>('date_desc');

  // Filtros de Corridas
  const [delFilterMode, setDelFilterMode] = useState<'smart_shift' | 'date_range' | 'all'>('smart_shift');
  const [delSmartDate, setDelSmartDate] = useState<string>(db.getOperationalDateString());
  const [delSmartPeriod, setDelSmartPeriod] = useState<'all_shifts' | 'night_shift' | 'morning_shift' | 'afternoon_shift'>('all_shifts');

  const [delRiderFilter, setDelRiderFilter] = useState<string>('all');
  const [delEstFilter, setDelEstFilter] = useState<string>('all');
  const [delStatusFilter, setDelStatusFilter] = useState<string>('all');
  const [delFeatureFilter, setDelFeatureFilter] = useState<'all' | 'same_order_number' | 'with_additional' | 'linked' | 'standard'>('all');
  const [delPaymentFilter, setDelPaymentFilter] = useState<'all' | 'to_collect' | 'money' | 'card' | 'pix' | 'already_paid'>('all');
  const [delDateFrom, setDelDateFrom] = useState<string>('');
  const [delDateTo, setDelDateTo] = useState<string>('');
  const [delSearchQuery, setDelSearchQuery] = useState<string>('');
  const [delOrderNumberFilter, setDelOrderNumberFilter] = useState<string>('');
  const [delNotesFilter, setDelNotesFilter] = useState<'all' | 'with_notes' | 'without_notes'>('all');
  const [delSortOrder, setDelSortOrder] = useState<'date_desc' | 'date_asc' | 'order_number_grouped' | 'value_desc' | 'value_asc' | 'rider_name' | 'est_name'>('date_desc');

  // Filtros de Fechamento Financeiro
  const [financePeriodMode, setFinancePeriodMode] = useState<'this_week' | 'last_week' | 'today' | 'this_month' | 'custom'>('this_week');
  const [financeCustomFrom, setFinanceCustomFrom] = useState<string>('');
  const [financeCustomTo, setFinanceCustomTo] = useState<string>('');
  const [financePaidFilter, setFinancePaidFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const [financeFeatureFilter, setFinanceFeatureFilter] = useState<'all' | 'same_order_number' | 'with_additional' | 'linked' | 'standard'>('all');
  const [financePaymentFilter, setFinancePaymentFilter] = useState<'all' | 'to_collect' | 'money' | 'card' | 'pix' | 'already_paid'>('all');
  const [financeRiderSearch, setFinanceRiderSearch] = useState<string>('');
  const [financeEstSearch, setFinanceEstSearch] = useState<string>('');
  const [financeActiveSection, setFinanceActiveSection] = useState<'riders' | 'establishments'>('riders');

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    name: '', cpf: '', phone: '', email: '', role: 'rider' as any, password: '', establishmentId: '', establishmentName: '', zipCode: '', street: '', number: '', neighborhood: '', city: '', state: ''
  });

  const [showEstModal, setShowEstModal] = useState(false);
  const [editingEst, setEditingEst] = useState<Establishment | null>(null);
  const [estForm, setEstForm] = useState({
    name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: '', email: '', password: ''
  });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedRiderIds, setSelectedRiderIds] = useState<string[]>([]);
  const [scheduleForm, setScheduleForm] = useState({ 
    riderId: '', establishmentId: '', date: '', shift: 'morning' as any, startTime: '08:00', endTime: '12:00'
  });
  const [scheduleConflictWarning, setScheduleConflictWarning] = useState('');

  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [weeklySelectedRiderIds, setWeeklySelectedRiderIds] = useState<string[]>([]);
  const [weeklyForm, setWeeklyForm] = useState({
    riderId: '', establishmentId: '', shift: 'morning' as any, startTime: '08:00', endTime: '12:00', weekStart: '',
    days: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false }
  });
  const [weeklyPreview, setWeeklyPreview] = useState<any[]>([]);
  const [weeklyStep, setWeeklyStep] = useState<'form' | 'preview'>('form');

  const [riderSchedulesModal, setRiderSchedulesModal] = useState<string | null>(null);
  const [modalHistoryEst, setModalHistoryEst] = useState('');
  const [modalHistoryFrom, setModalHistoryFrom] = useState('');
  const [modalHistoryTo, setModalHistoryTo] = useState('');

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    riderId: '',
    establishmentId: '',
    date: '',
    time: '',
    value: '',
    orderNumber: '',
    notes: '',
    deliveryType: 'standard' as 'standard' | 'same_address',
    additionalValue: '',
    additionalReason: '',
    linkedOrderNumber: '',
    paymentMethod: 'already_paid' as 'already_paid' | 'money' | 'card_debit' | 'card_credit' | 'pix_delivery',
    orderCollectionAmount: '',
    changeFor: ''
  });

  const [showBatchModal, setShowBatchModal] = useState(false);

  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  const [reportType, setReportType] = useState<'earnings' | 'deliveries' | 'schedules'>('earnings');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const hasSetInitialAdminMapBoundsRef = useRef(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const loadData = () => {
    const currentUsers = db.getUsers();
    const currentEsts = db.getEstablishments();
    const currentSchedules = db.getSchedules();
    const currentDeliveries = db.getDeliveries();
    const rawRequests = db.getPartnerRequests();
    const locations = db.getRiderLocations();

    setUsers([...currentUsers].sort((a, b) => a.name.localeCompare(b.name)));
    setEstablishments([...currentEsts].sort((a, b) => a.name.localeCompare(b.name)));
    setSchedules([...currentSchedules].sort((a, b) => b.date.localeCompare(a.date) || b.shift.localeCompare(a.shift) || a.id.localeCompare(b.id)));
    setDeliveries([...currentDeliveries].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.id.localeCompare(a.id)));
    setPartnerRequests([...rawRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setRiderLocations(locations);
  };

  const handleSyncToSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const res = await db.syncLocalToSupabase();
      loadData();
      alert(`🎉 Sincronização concluída com sucesso!\n\n${res.deliveriesCount} corridas verificadas e enviadas ao banco de dados do Supabase.`);
    } catch (e) {
      alert('Erro ao sincronizar com o Supabase. Verifique sua conexão com a internet.');
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin') {
      navigate('/login');
      return;
    }
    requestNotificationPermission();
    loadData();

    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadData());
    }, 2000);

    const unsubscribeLocation = realtimeGps.subscribeToLocations(() => {
      loadData();
    });

    const unsubscribeOffline = realtimeGps.subscribeToOffline((payload) => {
      if (mapRef.current && markersRef.current[payload.riderId]) {
        mapRef.current.removeLayer(markersRef.current[payload.riderId]);
        delete markersRef.current[payload.riderId];
      }
      loadData();
    });

    return () => {
      clearInterval(interval);
      unsubscribeLocation();
      unsubscribeOffline();
    };
  }, [adminUser, navigate, activeTab]);

  const onlineRiderLocations = riderLocations.filter(loc => {
    if (!loc.lat || !loc.lng || isNaN(loc.lat) || isNaN(loc.lng)) return false;
    const timeDiff = loc.updatedAt ? Date.now() - new Date(loc.updatedAt).getTime() : Infinity;
    return timeDiff <= ONLINE_THRESHOLD_MS;
  });

  const handleRecenterMap = () => {
    const currentMap = mapRef.current;
    if (!currentMap) return;
    const points: L.LatLngExpression[] = [];

    onlineRiderLocations.forEach(loc => {
      points.push([loc.lat, loc.lng]);
    });

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (points.length === 1) {
      currentMap.setView(points[0], 16);
    }
  };

  useEffect(() => {
    if (activeTab !== 'map' || !mapContainerRef.current) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!mapRef.current) {
      const mapInstance = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([-7.2247, -35.8878], 14);

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20
      }).addTo(mapInstance);

      mapRef.current = mapInstance;
    }

    const currentMap = mapRef.current;
    const points: L.LatLngExpression[] = [];

    const validIds = new Set(onlineRiderLocations.map(r => r.riderId));

    Object.keys(markersRef.current).forEach(markerId => {
      if (!validIds.has(markerId)) {
        currentMap.removeLayer(markersRef.current[markerId]);
        delete markersRef.current[markerId];
      }
    });

    onlineRiderLocations.forEach(loc => {
      points.push([loc.lat, loc.lng]);
      const riderName = loc.riderName || 'Entregador';
      const existingMarker = markersRef.current[loc.riderId];

      const htmlIcon = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="background: #0f172a; color: white; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; white-space: nowrap; margin-bottom: 2px; border: 1px solid #10b981; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            ${riderName} 🟢
          </div>
          <div style="background-color: #10b981; color: white; width: 38px; height: 38px; border-radius: 50%; border: 3px solid white; box-shadow: 0 6px 14px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center; animation: pulse 2s infinite;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M18 18v-3l-3-4H9l-3 4v3" /><rect x="8" y="6" width="5" height="5" rx="1" /><path d="M15 11l1.5-4.5H19" /></svg>
          </div>
        </div>
      `;

      const riderIcon = L.divIcon({
        html: htmlIcon,
        className: 'custom-admin-rider-icon',
        iconSize: [90, 60],
        iconAnchor: [45, 50]
      });

      if (existingMarker) {
        existingMarker.setLatLng([loc.lat, loc.lng]);
        existingMarker.setIcon(riderIcon);
      } else {
        const marker = L.marker([loc.lat, loc.lng], { icon: riderIcon }).addTo(currentMap).bindPopup(`<b>${riderName}</b><br/>🟢 Sinal GPS Ativo em tempo real`);
        markersRef.current[loc.riderId] = marker;
      }
    });

    if (!hasSetInitialAdminMapBoundsRef.current && points.length > 0) {
      if (points.length >= 2) {
        currentMap.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
      } else if (points.length === 1) {
        currentMap.setView(points[0], 16);
      }
      hasSetInitialAdminMapBoundsRef.current = true;
    }
  }, [activeTab, onlineRiderLocations]);

  const handleLogout = () => {
    db.setCurrentUser(null);
    navigate('/login');
  };

  const handleOpenDesignateModal = (preselectedRiderId?: string, preselectedEstId?: string) => {
    const activeRiders = users.filter(r => r.role === 'rider' && r.active);
    setScheduleForm({
      riderId: preselectedRiderId || (activeRiders.length > 0 ? activeRiders[0].id : ''),
      establishmentId: preselectedEstId || '',
      date: db.getOperationalDateString(),
      shift: 'morning',
      startTime: '08:00',
      endTime: '12:00'
    });
    setSelectedRiderIds(preselectedRiderId ? [preselectedRiderId] : []);
    setScheduleConflictWarning('');
    setShowScheduleModal(true);
  };

  const handleQuickResetPassword = async (userToReset: User) => {
    const newPass = prompt(`Digite a nova senha para ${userToReset.name}:`, 'moto123');
    if (newPass !== null && newPass.trim() !== '') {
      const allUsers = db.getUsers();
      const updated = allUsers.map(u => u.id === userToReset.id ? {
        ...u,
        passwordHash: newPass.trim(),
        must_reset_password: true,
        updatedAt: new Date().toISOString()
      } : u);
      await db.setUsers(updated);
      loadData();
      alert(`Senha alterada com sucesso para: ${newPass.trim()}`);
    }
  };

  const handleApproveAllPendingDeliveries = async () => {
    const pendingDels = deliveries.filter(d => d.status === 'pending');
    if (pendingDels.length === 0) {
      alert('Não há corridas pendentes para aprovar no momento.');
      return;
    }

    const cobrarCount = pendingDels.filter(d => d.paymentMethod && d.paymentMethod !== 'already_paid').length;
    let confirmMsg = `Deseja aprovar todas as ${pendingDels.length} corridas pendentes de uma só vez?`;
    if (cobrarCount > 0) {
      confirmMsg += `\n\n⚠️ ATENÇÃO: ${cobrarCount} corrida(s) possuem cobrança ao cliente (dinheiro, maquininha ou PIX). Certifique-se de que os valores foram recebidos e as maquininhas devolvidas antes de continuar.`;
    }

    if (confirm(confirmMsg)) {
      const allDeliveries = db.getDeliveries();
      const pendingIds = new Set(pendingDels.map(p => p.id));
      const updated = allDeliveries.map(d => pendingIds.has(d.id) ? {
        ...d,
        status: 'active' as const,
        updatedAt: new Date().toISOString()
      } : d);

      await db.setDeliveries(updated);
      loadData();
      alert(`${pendingDels.length} corridas aprovadas com sucesso!`);
    }
  };

  const handleZeroOutAllDeliveries = async () => {
    if (confirm('ATENÇÃO: Esta ação irá apagar DEFINITIVAMENTE todas as corridas e valores lançados de todos os motoboys e estabelecimentos no sistema. Deseja prosseguir?')) {
      if (confirm('Confirme mais uma vez: deseja limpar todo o histórico de faturamento agora?')) {
        await db.clearAllDeliveries();
        loadData();
        alert('Sistema zerado com sucesso! Todas as corridas foram removidas.');
      }
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const allUsers = db.getUsers();
    const allEsts = db.getEstablishments();
    const userCpf = userForm.role === 'establishment' ? db.generateUniqueDummyCpf() : userForm.cpf;

    const duplicateCpf = allUsers.find(u => u.cpf === userCpf && (!editingUser || u.id !== editingUser.id));
    const duplicateEmail = allUsers.find(u => u.email.toLowerCase() === userForm.email.toLowerCase() && (!editingUser || u.id !== editingUser.id));

    if (userForm.role !== 'establishment' && duplicateCpf && userCpf !== '000.000.000-00') {
      alert('Erro: CPF já cadastrado no sistema.');
      return;
    }
    if (duplicateEmail) {
      alert('Erro: E-mail já cadastrado no sistema.');
      return;
    }

    const nowStr = new Date().toISOString();
    let finalEstId = userForm.establishmentId;

    if (userForm.role === 'establishment' && userForm.establishmentName) {
      const existingEst = allEsts.find(e => e.name.toLowerCase() === userForm.establishmentName.toLowerCase());
      if (existingEst) {
        finalEstId = existingEst.id;
      } else {
        const newEstId = 'e_' + Date.now();
        const newEst: Establishment = {
          id: newEstId,
          name: userForm.establishmentName,
          email: userForm.email,
          phone: userForm.phone || '',
          active: true,
          address: {
            street: userForm.street || 'A definir',
            number: userForm.number || 'S/N',
            complement: '',
            neighborhood: userForm.neighborhood || 'A definir',
            city: userForm.city || 'A definir',
            state: userForm.state || 'PB',
            zipCode: userForm.zipCode || '00000-000'
          },
          updatedAt: nowStr
        };
        await db.setEstablishments([...allEsts, newEst]);
        finalEstId = newEstId;
      }
    }

    if (editingUser) {
      const updated = allUsers.map(u => u.id === editingUser.id ? {
        ...u,
        name: userForm.name,
        cpf: userCpf,
        phone: userForm.phone,
        email: userForm.email,
        role: userForm.role,
        establishmentId: userForm.role === 'establishment' ? finalEstId : undefined,
        passwordHash: userForm.password || u.passwordHash,
        mustResetPassword: userForm.password ? true : u.mustResetPassword,
        updatedAt: nowStr
      } : u);
      await db.setUsers(updated);
    } else {
      const newUser: User = {
        id: 'u_' + Date.now(),
        name: userForm.name,
        cpf: userCpf,
        phone: userForm.phone,
        email: userForm.email,
        role: userForm.role,
        active: true,
        passwordHash: userForm.password || 'moto123',
        establishmentId: userForm.role === 'establishment' ? finalEstId : undefined,
        updatedAt: nowStr
      };
      await db.setUsers([...allUsers, newUser]);
    }

    setShowUserModal(false);
    setEditingUser(null);
    loadData();
  };

  const handleDeleteUser = async (id: string) => {
    if (id === adminUser?.id) {
      alert('Erro: Você não pode excluir a si mesmo.');
      return;
    }
    if (confirm('Deseja realmente excluir este usuário definitivamente?')) {
      await db.deleteUser(id);
      loadData();
    }
  };

  const toggleUserStatus = async (id: string) => {
    const allUsers = db.getUsers();
    const updated = allUsers.map(u => u.id === id ? { ...u, active: !u.active, updatedAt: new Date().toISOString() } : u);
    await db.setUsers(updated);
    loadData();
  };

  const handleApproveRider = async (id: string) => {
    const allUsers = db.getUsers();
    const updatedUsers = allUsers.map(u => u.id === id ? { ...u, active: true, updatedAt: new Date().toISOString() } : u);
    await db.setUsers(updatedUsers);
    loadData();
    alert('Usuário aprovado com sucesso!');
  };

  const handleSaveEst = async (e: React.FormEvent) => {
    e.preventDefault();
    const allEst = db.getEstablishments();

    const duplicateName = allEst.find(es => es.name.toLowerCase() === estForm.name.toLowerCase() && (!editingEst || es.id !== editingEst.id));
    if (duplicateName) {
      alert('Erro: Já existe um estabelecimento com este nome.');
      return;
    }

    const estId = editingEst ? editingEst.id : 'e_' + Date.now();
    const nowStr = new Date().toISOString();

    if (editingEst) {
      const updated = allEst.map(es => es.id === editingEst.id ? {
        ...es,
        name: estForm.name,
        email: estForm.email || es.email,
        phone: estForm.phone,
        address: {
          street: estForm.street,
          number: estForm.number,
          complement: estForm.complement || '',
          neighborhood: estForm.neighborhood,
          city: estForm.city,
          state: estForm.state,
          zipCode: estForm.zipCode
        },
        updatedAt: nowStr
      } : es);
      await db.setEstablishments(updated);
    } else {
      const newEst: Establishment = {
        id: estId,
        name: estForm.name,
        email: estForm.email,
        phone: estForm.phone,
        active: true,
        address: {
          street: estForm.street,
          number: estForm.number,
          complement: estForm.complement || '',
          neighborhood: estForm.neighborhood,
          city: estForm.city,
          state: estForm.state,
          zipCode: estForm.zipCode
        },
        updatedAt: nowStr
      };
      await db.setEstablishments([...allEst, newEst]);
    }

    setShowEstModal(false);
    setEditingEst(null);
    loadData();
  };

  const handleDeleteEst = async (id: string) => {
    if (confirm('Deseja realmente excluir este estabelecimento definitivamente?')) {
      await db.deleteEstablishment(id);
      loadData();
    }
  };

  const toggleEstStatus = async (id: string) => {
    const allEst = db.getEstablishments();
    const updated = allEst.map(es => es.id === id ? { ...es, active: !es.active, updatedAt: new Date().toISOString() } : es);
    await db.setEstablishments(updated);
    loadData();
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    const riderIdsToSchedule = selectedRiderIds.length > 0 
      ? selectedRiderIds 
      : (scheduleForm.riderId ? [scheduleForm.riderId] : []);

    if (riderIdsToSchedule.length === 0) {
      alert('Erro: Selecione pelo menos um motoboy.');
      return;
    }

    if (!scheduleForm.establishmentId) {
      alert('Erro: Selecione um estabelecimento.');
      return;
    }

    const currentAllSchedules = db.getSchedules();
    const newSchedules: Schedule[] = [];
    const conflicts: string[] = [];

    riderIdsToSchedule.forEach(rId => {
      const rider = users.find(r => r.id === rId);
      const conflict = currentAllSchedules.find(s => s.riderId === rId && s.date === scheduleForm.date && s.shift === scheduleForm.shift);
      
      if (conflict) {
        const est = establishments.find(es => es.id === conflict.establishmentId);
        conflicts.push(`${rider?.name || 'Motoboy'} (escalado em ${est?.name || 'outro estabelecimento'})`);
      } else {
        newSchedules.push({
          id: 's_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          riderId: rId,
          establishmentId: scheduleForm.establishmentId,
          date: scheduleForm.date,
          shift: scheduleForm.shift,
          startTime: scheduleForm.startTime,
          endTime: scheduleForm.endTime,
          createdBy: adminUser?.name || 'Admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });

    if (newSchedules.length === 0) {
      alert(`Não foi possível criar as escalas devido a conflitos de horário para todos os motoboys selecionados:\n\n• ${conflicts.join('\n• ')}`);
      return;
    }

    await db.setSchedules([...currentAllSchedules, ...newSchedules]);

    setShowScheduleModal(false);
    setSelectedRiderIds([]);
    setScheduleConflictWarning('');
    loadData();

    if (conflicts.length > 0) {
      alert(`${newSchedules.length} escala(s) criada(s) com sucesso!\n\nOs seguintes motoboys foram ignorados por conflito de horário:\n• ${conflicts.join('\n• ')}`);
    } else if (newSchedules.length > 1) {
      alert(`${newSchedules.length} escalas criadas com sucesso simultaneamente!`);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    if (confirm('Tem certeza que deseja cancelar esta escala?')) {
      await db.deleteSchedule(id);
      loadData();
    }
  };

  const buildWeeklyPreview = (form: typeof weeklyForm) => {
    if (!form.weekStart || !form.establishmentId) return;

    const [year, month, day] = form.weekStart.split('-').map(Number);
    const monday = new Date(year, month - 1, day);
    const allSchedules = db.getSchedules();

    const targetRiders = weeklySelectedRiderIds.length > 0 ? weeklySelectedRiderIds : (form.riderId ? [form.riderId] : []);

    const preview = DAY_KEYS.map((key, idx) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dateNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dateNum}`;

      const conflict = targetRiders.some(rId => 
        allSchedules.some(s => s.riderId === rId && s.date === dateStr && s.shift === form.shift)
      );

      return { date: dateStr, label: DAY_LABELS[idx], conflict, key, enabled: form.days[key] };
    });

    setWeeklyPreview(preview);
    setWeeklyStep('preview');
  };

  const handleSaveWeeklySchedule = async () => {
    const allSchedules = db.getSchedules();
    const newSchedules: Schedule[] = [];

    const targetRiders = weeklySelectedRiderIds.length > 0 ? weeklySelectedRiderIds : (weeklyForm.riderId ? [weeklyForm.riderId] : []);
    const validDays = weeklyPreview.filter(day => day.enabled);

    if (validDays.length === 0 || targetRiders.length === 0) {
      alert('Erro: NENHUM motoboy ou dia válido selecionado.');
      return;
    }

    let createdCount = 0;
    let conflictCount = 0;

    targetRiders.forEach(rId => {
      validDays.forEach(day => {
        const hasConflict = allSchedules.some(s => s.riderId === rId && s.date === day.date && s.shift === weeklyForm.shift);
        if (hasConflict) {
          conflictCount++;
        } else {
          const id = 's_' + Date.now() + '_' + rId.slice(-4) + '_' + day.date + '_' + Math.random().toString(36).substring(2, 5);
          newSchedules.push({
            id,
            riderId: rId,
            establishmentId: weeklyForm.establishmentId,
            date: day.date,
            shift: weeklyForm.shift,
            startTime: weeklyForm.startTime,
            endTime: weeklyForm.endTime,
            createdBy: adminUser?.name || 'Admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          createdCount++;
        }
      });
    });

    if (newSchedules.length > 0) {
      await db.setSchedules([...allSchedules, ...newSchedules]);
    }

    setShowWeeklyModal(false);
    setWeeklyStep('form');
    setWeeklySelectedRiderIds([]);
    loadData();

    alert(`${createdCount} escala(s) criada(s) com sucesso para ${targetRiders.length} motoboy(s)!${conflictCount > 0 ? ` (${conflictCount} ignoradas por conflito)` : ''}`);
  };

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseVal = parseFloat(deliveryForm.value);
    const addVal = parseFloat(deliveryForm.additionalValue || '0') || 0;
    const finalVal = baseVal + addVal;

    if (isNaN(finalVal) || finalVal <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    const cleanOrderNumber = deliveryForm.orderNumber.trim().replace('#', '');
    if (cleanOrderNumber) {
      const dupCheck = db.checkDuplicateOrderNumber(cleanOrderNumber, deliveryForm.date, deliveryForm.time, editingDelivery?.id);
      if (dupCheck.isDuplicate) {
        const confirmDuplicate = confirm(
          `⚠️ Aviso: O pedido #${cleanOrderNumber} já consta lançado hoje para "${dupCheck.riderName}".\n\n` +
          `Como Administrador, você pode autorizar pedidos divididos ou complementares.\n\n` +
          `Deseja confirmar o lançamento desta corrida duplicada/dividida mesmo assim?`
        );
        if (!confirmDuplicate) {
          return;
        }
      }
    }

    const activeSchedule = schedules.find(s => s.riderId === deliveryForm.riderId && s.establishmentId === deliveryForm.establishmentId && s.date === deliveryForm.date);
    const nowStr = new Date().toISOString();

    const collectionAmount = deliveryForm.orderCollectionAmount ? parseFloat(deliveryForm.orderCollectionAmount.replace(',', '.')) : undefined;
    const changeForValue = deliveryForm.changeFor ? parseFloat(deliveryForm.changeFor.replace(',', '.')) : undefined;

    if (editingDelivery) {
      const updated = deliveries.map(d => d.id === editingDelivery.id ? {
        ...d,
        riderId: deliveryForm.riderId,
        establishmentId: deliveryForm.establishmentId,
        date: deliveryForm.date,
        time: deliveryForm.time,
        value: finalVal,
        scheduleId: activeSchedule?.id || d.scheduleId,
        orderNumber: cleanOrderNumber || undefined,
        notes: deliveryForm.notes.trim() || undefined,
        deliveryType: deliveryForm.deliveryType,
        additionalValue: addVal > 0 ? addVal : undefined,
        additionalReason: deliveryForm.additionalReason?.trim() || undefined,
        linkedOrderNumber: deliveryForm.deliveryType === 'same_address' ? (deliveryForm.linkedOrderNumber?.trim().replace('#', '') || undefined) : undefined,
        paymentMethod: deliveryForm.paymentMethod,
        orderCollectionAmount: collectionAmount,
        changeFor: changeForValue,
        updatedAt: nowStr
      } : d);
      await db.setDeliveries(updated);
    } else {
      const newDelivery: Delivery = {
        id: 'd_' + Date.now(),
        riderId: deliveryForm.riderId,
        establishmentId: deliveryForm.establishmentId,
        date: deliveryForm.date,
        time: deliveryForm.time,
        value: finalVal,
        status: 'active',
        scheduleId: activeSchedule?.id,
        orderNumber: cleanOrderNumber || undefined,
        notes: deliveryForm.notes.trim() || undefined,
        deliveryType: deliveryForm.deliveryType,
        additionalValue: addVal > 0 ? addVal : undefined,
        additionalReason: deliveryForm.additionalReason?.trim() || undefined,
        linkedOrderNumber: deliveryForm.deliveryType === 'same_address' ? (deliveryForm.linkedOrderNumber?.trim().replace('#', '') || undefined) : undefined,
        paymentMethod: deliveryForm.paymentMethod,
        orderCollectionAmount: collectionAmount,
        changeFor: changeForValue,
        updatedAt: nowStr,
        paid: false
      };
      await db.setDeliveries([...deliveries, newDelivery]);
    }

    setShowDeliveryModal(false);
    setEditingDelivery(null);
    loadData();
  };

  const handleDeleteDelivery = async (id: string) => {
    if (confirm('Deseja realmente excluir esta corrida definitivamente do banco de dados?')) {
      await db.deleteDelivery(id);
      loadData();
    }
  };

  const handleApproveDelivery = async (id: string) => {
    const deliveryToApprove = deliveries.find(d => d.id === id);

    if (deliveryToApprove) {
      const pm = deliveryToApprove.paymentMethod || 'already_paid';
      const rider = users.find(u => u.id === deliveryToApprove.riderId);
      const est = establishments.find(e => e.id === deliveryToApprove.establishmentId);
      const riderName = rider?.name || 'o motoboy';
      const estName = est?.name || 'o estabelecimento';
      const orderNum = deliveryToApprove.orderNumber ? `#${deliveryToApprove.orderNumber}` : '';
      const amountStr = deliveryToApprove.orderCollectionAmount ? `R$ ${Number(deliveryToApprove.orderCollectionAmount).toFixed(2)}` : 'o valor do pedido';

      if (pm === 'money') {
        const changeMsg = deliveryToApprove.changeFor ? ` (troco para R$ ${Number(deliveryToApprove.changeFor).toFixed(2)})` : '';
        const confirmed = confirm(
          `💰 CONFERÊNCIA DE COBRANÇA EM DINHEIRO:\n\n` +
          `Pedido: ${orderNum}\n` +
          `Estabelecimento: ${estName}\n` +
          `Entregador: ${riderName}\n` +
          `Valor a receber do cliente: ${amountStr}${changeMsg}\n\n` +
          `👉 O entregador ${riderName} já repassou este dinheiro em espécie para o caixa do estabelecimento ${estName}?\n\n` +
          `Clique em "OK" para confirmar que o dinheiro foi entregue e aprovar a corrida.`
        );
        if (!confirmed) return;
      } else if (pm === 'card_debit' || pm === 'card_credit') {
        const tipoCartao = pm === 'card_debit' ? 'DÉBITO' : 'CRÉDITO';
        const confirmed = confirm(
          `💳 CONFERÊNCIA DE MAQUINETA E PAGAMENTO NO CARTÃO (${tipoCartao}):\n\n` +
          `Pedido: ${orderNum}\n` +
          `Estabelecimento: ${estName}\n` +
          `Entregador: ${riderName}\n` +
          `Valor cobrado na máquina: ${amountStr}\n\n` +
          `👉 O entregador ${riderName} já devolveu a maquineta de cartão e o comprovante para ${estName}?\n\n` +
          `Clique em "OK" para confirmar a devolução da maquineta e aprovar a corrida.`
        );
        if (!confirmed) return;
      } else if (pm === 'pix_delivery') {
        const confirmed = confirm(
          `📱 CONFERÊNCIA DE PAGAMENTO VIA PIX NA ENTREGA:\n\n` +
          `Pedido: ${orderNum}\n` +
          `Estabelecimento: ${estName}\n` +
          `Valor do PIX: ${amountStr}\n\n` +
          `👉 O comprovante de PIX do cliente já foi conferido e recebido na conta do estabelecimento ${estName}?\n\n` +
          `Clique em "OK" para confirmar o recebimento e aprovar a corrida.`
        );
        if (!confirmed) return;
      }
    }

    const updated = deliveries.map(d => d.id === id ? { ...d, status: 'active' as const, updatedAt: new Date().toISOString() } : d);
    await db.setDeliveries(updated);
    loadData();
  };

  const handleRejectDelivery = async (id: string) => {
    const reason = prompt('Digite o motivo da rejeição:');
    if (reason !== null) {
      const updated = deliveries.map(d => d.id === id ? { ...d, status: 'rejected' as const, notes: reason, updatedAt: new Date().toISOString() } : d);
      await db.setDeliveries(updated);
      loadData();
    }
  };

  const handleContactRequest = (request: PartnerRequest) => {
    const cleanPhone = request.phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(`Olá ${request.ownerName}! Recebemos sua solicitação de parceria para o estabelecimento ${request.establishmentName} no MotoHub.`);
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const handleApproveRequest = async (req: PartnerRequest) => {
    const allEsts = db.getEstablishments();
    const est = allEsts.find(e => e.name.toLowerCase().trim() === req.establishmentName.toLowerCase().trim());
    if (est) {
      const updatedEsts = allEsts.map(e => e.id === est.id ? { ...e, active: true, updatedAt: new Date().toISOString() } : e);
      await db.setEstablishments(updatedEsts);
      loadData();
      alert('Solicitação aprovada com sucesso!');
    } else {
      alert('Erro: Estabelecimento correspondente não encontrado.');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (confirm('Deseja realmente excluir esta solicitação?')) {
      await db.deletePartnerRequest(id);
      loadData();
    }
  };

  const handleSettleRiderDeliveries = async (riderId: string, deliveryIds?: string[]) => {
    const rider = users.find(u => u.id === riderId);
    if (!rider) return;

    const msg = deliveryIds && deliveryIds.length > 0
      ? `Deseja dar baixa e marcar ${deliveryIds.length} corrida(s) do motoboy ${rider.name} como PAGAS?`
      : `Deseja realmente dar baixa e marcar TODAS as corridas ativas deste motoboy como pagas?`;

    if (confirm(msg)) {
      const allDeliveries = db.getDeliveries();
      const idSet = deliveryIds ? new Set(deliveryIds) : null;
      const updated = allDeliveries.map(d => {
        const matches = idSet ? idSet.has(d.id) : (d.riderId === riderId && d.status === 'active');
        return matches ? { ...d, paid: true, updatedAt: new Date().toISOString() } : d;
      });
      await db.setDeliveries(updated);
      loadData();
    }
  };

  const handleUnsettleRiderDeliveries = async (riderId: string, deliveryIds?: string[]) => {
    const rider = users.find(u => u.id === riderId);
    if (!rider) return;

    if (confirm(`Deseja reverter e marcar as corridas de ${rider.name} como PENDENTES DE REPASSE?`)) {
      const allDeliveries = db.getDeliveries();
      const idSet = deliveryIds ? new Set(deliveryIds) : null;
      const updated = allDeliveries.map(d => {
        const matches = idSet ? idSet.has(d.id) : (d.riderId === riderId && d.status === 'active');
        return matches ? { ...d, paid: false, updatedAt: new Date().toISOString() } : d;
      });
      await db.setDeliveries(updated);
      loadData();
    }
  };

  const handleSettleEstDeliveries = async (estId: string, deliveryIds?: string[]) => {
    const est = establishments.find(e => e.id === estId);
    if (!est) return;

    const msg = deliveryIds && deliveryIds.length > 0
      ? `Deseja dar baixa e marcar ${deliveryIds.length} corrida(s) do estabelecimento ${est.name} como RECEBIDAS/PAGAS?`
      : `Deseja realmente dar baixa e marcar TODAS as corridas ativas deste estabelecimento como recebidas/pagas?`;

    if (confirm(msg)) {
      const allDeliveries = db.getDeliveries();
      const idSet = deliveryIds ? new Set(deliveryIds) : null;
      const updated = allDeliveries.map(d => {
        const matches = idSet ? idSet.has(d.id) : (d.establishmentId === estId && d.status === 'active');
        return matches ? { ...d, paid: true, updatedAt: new Date().toISOString() } : d;
      });
      await db.setDeliveries(updated);
      loadData();
    }
  };

  const handleSaveNotes = async (deliveryId: string, updatedNotes: string) => {
    const allDeliveries = db.getDeliveries();
    const updated = allDeliveries.map(d => d.id === deliveryId ? {
      ...d,
      notes: updatedNotes,
      updatedAt: new Date().toISOString()
    } : d);
    await db.setDeliveries(updated);
    loadData();
  };

  const handleSaveScheduleChat = async (scheduleId: string, updatedChat: string) => {
    const allSchedules = db.getSchedules();
    const updated = allSchedules.map(s => s.id === scheduleId ? {
      ...s,
      chat: updatedChat,
      updatedAt: new Date().toISOString()
    } : s);
    await db.setSchedules(updated);
    loadData();
  };

  const setDelSmartDateToToday = () => {
    setDelSmartDate(db.getOperationalDateString());
  };

  const setDelSmartDateToYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDelSmartDate(db.getOperationalDateString(d));
  };

  // Mapa de contagem de repetições por data e número de pedido
  const orderNumberCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    deliveries.forEach(d => {
      if (d.status === 'cancelled') return;
      const num = (d.orderNumber || '').trim().replace('#', '');
      if (num) {
        const opDate = getDeliveryOperationalDate(d.date, d.time);
        const key = `${opDate}_${num}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return map;
  }, [deliveries]);

  const getOrderRepeatCount = (d: Delivery): number => {
    const num = (d.orderNumber || '').trim().replace('#', '');
    if (!num) return 0;
    const opDate = getDeliveryOperationalDate(d.date, d.time);
    return orderNumberCountMap.get(`${opDate}_${num}`) || 0;
  };

  const getFinanceDateBounds = (): { start: string; end: string; label: string } => {
    const now = new Date();
    if (financePeriodMode === 'today') {
      const todayStr = db.getOperationalDateString();
      return { start: todayStr, end: todayStr, label: 'Hoje (Turno Atual)' };
    }

    if (financePeriodMode === 'this_week') {
      const monStr = getThisMonday();
      const [y, m, d] = monStr.split('-').map(Number);
      const sun = new Date(y, m - 1, d + 6);
      const sunStr = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
      return { start: monStr, end: sunStr, label: 'Esta Semana (Segunda a Domingo)' };
    }

    if (financePeriodMode === 'last_week') {
      const monStr = getThisMonday();
      const [y, m, d] = monStr.split('-').map(Number);
      const lastMon = new Date(y, m - 1, d - 7);
      const lastSun = new Date(y, m - 1, d - 1);
      const lastMonStr = `${lastMon.getFullYear()}-${String(lastMon.getMonth() + 1).padStart(2, '0')}-${String(lastSun.getDate()).padStart(2, '0')}`;
      const lastSunStr = `${lastSun.getFullYear()}-${String(lastSun.getMonth() + 1).padStart(2, '0')}-${String(lastSun.getDate()).padStart(2, '0')}`;
      return { start: lastMonStr, end: lastSunStr, label: 'Semana Passada' };
    }

    if (financePeriodMode === 'this_month') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start: startStr, end: endStr, label: 'Este Mês' };
    }

    return {
      start: financeCustomFrom || '1970-01-01',
      end: financeCustomTo || '2099-12-31',
      label: 'Período Personalizado'
    };
  };

  const financeBounds = getFinanceDateBounds();

  const financeFilteredDeliveries = deliveries.filter(d => {
    if (d.status !== 'active') return false;

    if (d.date < financeBounds.start || d.date > financeBounds.end) return false;

    if (financePaidFilter === 'unpaid' && d.paid) return false;
    if (financePaidFilter === 'paid' && !d.paid) return false;

    if (financeFeatureFilter === 'same_order_number') {
      const repeats = getOrderRepeatCount(d);
      if (repeats <= 1) return false;
    } else if (financeFeatureFilter === 'with_additional' && (!d.additionalValue || Number(d.additionalValue) <= 0)) {
      return false;
    } else if (financeFeatureFilter === 'linked' && (d.deliveryType !== 'same_address' && !d.linkedOrderNumber)) {
      return false;
    } else if (financeFeatureFilter === 'standard' && (d.deliveryType === 'same_address' || Boolean(d.linkedOrderNumber) || (d.additionalValue && Number(d.additionalValue) > 0))) {
      return false;
    }

    // Filtro de cobrança no fechamento
    if (financePaymentFilter === 'to_collect' && (!d.paymentMethod || d.paymentMethod === 'already_paid')) return false;
    if (financePaymentFilter === 'money' && d.paymentMethod !== 'money') return false;
    if (financePaymentFilter === 'card' && d.paymentMethod !== 'card_debit' && d.paymentMethod !== 'card_credit') return false;
    if (financePaymentFilter === 'pix' && d.paymentMethod !== 'pix_delivery') return false;
    if (financePaymentFilter === 'already_paid' && d.paymentMethod && d.paymentMethod !== 'already_paid') return false;

    return true;
  });

  const renderPaymentBadge = (delivery: Delivery) => {
    const pm = delivery.paymentMethod || 'already_paid';
    if (pm === 'already_paid') return null;

    const amountStr = delivery.orderCollectionAmount ? `R$ ${Number(delivery.orderCollectionAmount).toFixed(2)}` : '';
    const changeStr = delivery.changeFor ? ` (Troco p/ R$ ${Number(delivery.changeFor).toFixed(2)})` : '';

    if (pm === 'money') {
      return (
        <div className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-emerald-400 mt-1">
          <Banknote className="h-3.5 w-3.5 flex-shrink-0" />
          <span>COBRAR EM DINHEIRO: {amountStr}{changeStr}</span>
        </div>
      );
    }

    if (pm === 'card_debit') {
      return (
        <div className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-blue-400 mt-1">
          <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
          <span>COBRAR NO DÉBITO: {amountStr} (LEVAR MAQUININHA)</span>
        </div>
      );
    }

    if (pm === 'card_credit') {
      return (
        <div className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-indigo-400 mt-1">
          <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
          <span>COBRAR NO CRÉDITO: {amountStr} (LEVAR MAQUININHA)</span>
        </div>
      );
    }

    if (pm === 'pix_delivery') {
      return (
        <div className="bg-teal-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-teal-400 mt-1">
          <QrCode className="h-3.5 w-3.5 flex-shrink-0" />
          <span>COBRAR NO PIX: {amountStr}</span>
        </div>
      );
    }

    return null;
  };

  const totalFinanceGrossRevenue = financeFilteredDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalFinanceDeliveriesCount = financeFilteredDeliveries.length;
  // Corridas de mesmo endereço (R$ 4,00) são 100% isentas da taxa administrativa
  const totalFinanceAdminCommission = financeFilteredDeliveries.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
  const totalFinanceRidersNet = Math.max(0, totalFinanceGrossRevenue - totalFinanceAdminCommission);

  const getFilteredReportData = () => {
    let start = new Date();
    let end = new Date();
    if (reportPeriod === 'daily') {
      const opDateStr = db.getOperationalDateString();
      start = new Date(opDateStr + 'T00:00:00');
      end = new Date(opDateStr + 'T23:59:59');
    } else if (reportPeriod === 'weekly') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(start.setDate(diff));
      start.setHours(0,0,0,0);
    } else if (reportPeriod === 'monthly') {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
    } else if (reportPeriod === 'custom' && customStartDate && customEndDate) {
      start = new Date(customStartDate + 'T00:00:00');
      end = new Date(customEndDate + 'T23:59:59');
    }

    const riders = users.filter(u => u.role === 'rider');
    if (reportType === 'earnings') {
      const summary: any = {};
      riders.forEach(r => { summary[r.id] = { name: r.name, total: 0, count: 0 }; });
      deliveries.filter(d => d.status === 'active').forEach(d => {
        const dDate = new Date(d.date + 'T00:00:00');
        if (dDate >= start && dDate <= end && summary[d.riderId]) {
          summary[d.riderId].total += d.value;
          summary[d.riderId].count += 1;
        }
      });
      return Object.values(summary);
    } else if (reportType === 'deliveries') {
      const summary: any = {};
      riders.forEach(r => { summary[r.id] = { name: r.name, count: 0, cancelled: 0 }; });
      deliveries.forEach(d => {
        const dDate = new Date(d.date + 'T00:00:00');
        if (dDate >= start && dDate <= end && summary[d.riderId]) {
          if (d.status === 'active') summary[d.riderId].count += 1;
          else summary[d.riderId].cancelled += 1;
        }
      });
      return Object.values(summary);
    } else {
      const summary: any = {};
      establishments.forEach(e => { summary[e.id] = { name: e.name, count: 0 }; });
      schedules.forEach(s => {
        const sDate = new Date(s.date + 'T00:00:00');
        const dDate = sDate;
        if (sDate >= start && dDate <= end && summary[s.establishmentId]) {
          summary[s.establishmentId].count += 1;
        }
      });
      return Object.values(summary);
    }
  };

  const exportToCSV = () => {
    const data = getFilteredReportData();
    let csvContent = "data:text/csv;charset=utf-8,";
    if (reportType === 'earnings') {
      csvContent += "Motoboy,Total Faturado (R$),Quantidade de Corridas\n";
      data.forEach((row: any) => { csvContent += `"${row.name}",${row.total.toFixed(2)},${row.count}\n`; });
    } else if (reportType === 'deliveries') {
      csvContent += "Motoboy,Corridas Ativas,Corridas Canceladas\n";
      data.forEach((row: any) => { csvContent += `"${row.name}",${row.count},${row.cancelled}\n`; });
    } else {
      csvContent += "Estabelecimento,Total de Escalas\n";
      data.forEach((row: any) => { csvContent += `"${row.name}",${row.count}\n`; });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_${reportType}_${reportPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.cpf.includes(searchQuery) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && u.active) || (statusFilter === 'inactive' && !u.active);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const filteredEsts = establishments.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && e.active) || (statusFilter === 'inactive' && !e.active);
    return matchesSearch && matchesStatus;
  });

  const filteredRequests = partnerRequests.filter(r => {
    const matchesSearch = r.establishmentName.toLowerCase().includes(searchQuery.toLowerCase()) || r.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = requestStatusFilter === 'all' || r.status === requestStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const todayStr = db.getOperationalDateString();
  const filteredAndSortedSchedules = schedules
    .filter(s => {
      const rider = users.find(u => u.id === s.riderId);
      const est = establishments.find(e => e.id === s.establishmentId);

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const rName = rider?.name.toLowerCase() || '';
        const eName = est?.name.toLowerCase() || '';
        if (!rName.includes(q) && !eName.includes(q)) return false;
      }

      if (schRiderFilter !== 'all' && s.riderId !== schRiderFilter) return false;
      if (schEstFilter !== 'all' && s.establishmentId !== schEstFilter) return false;
      if (schShiftFilter !== 'all' && s.shift !== schShiftFilter) return false;
      if (schSpecificDate && s.date !== schSpecificDate) return false;

      if (schTimeframeFilter === 'today' && s.date !== todayStr) return false;
      if (schTimeframeFilter === 'upcoming' && s.date < todayStr) return false;
      if (schTimeframeFilter === 'past' && s.date >= todayStr) return false;

      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredAndSortedDeliveries = deliveries
    .filter(d => {
      const rider = users.find(u => u.id === d.riderId);
      const est = establishments.find(e => e.id === d.establishmentId);

      const hasNotes = Boolean(d.notes && d.notes.trim().length > 0);
      if (delNotesFilter === 'with_notes' && !hasNotes) return false;
      if (delNotesFilter === 'without_notes' && hasNotes) return false;

      if (delFeatureFilter === 'same_order_number') {
        const repeats = getOrderRepeatCount(d);
        if (repeats <= 1) return false;
      } else if (delFeatureFilter === 'with_additional') {
        const hasAdd = Number(d.additionalValue || 0) > 0;
        if (!hasAdd) return false;
      } else if (delFeatureFilter === 'linked') {
        const isLinked = d.deliveryType === 'same_address' || Boolean(d.linkedOrderNumber);
        if (!isLinked) return false;
      } else if (delFeatureFilter === 'standard') {
        const isStandard = d.deliveryType !== 'same_address' && !d.linkedOrderNumber && (!d.additionalValue || Number(d.additionalValue) <= 0);
        if (!isStandard) return false;
      }

      if (delPaymentFilter === 'to_collect') {
        const isCollect = d.paymentMethod && d.paymentMethod !== 'already_paid';
        if (!isCollect) return false;
      } else if (delPaymentFilter === 'money') {
        if (d.paymentMethod !== 'money') return false;
      } else if (delPaymentFilter === 'card') {
        if (d.paymentMethod !== 'card_debit' && d.paymentMethod !== 'card_credit') return false;
      } else if (delPaymentFilter === 'pix') {
        if (d.paymentMethod !== 'pix_delivery') return false;
      } else if (delPaymentFilter === 'already_paid') {
        if (d.paymentMethod && d.paymentMethod !== 'already_paid') return false;
      }

      if (delOrderNumberFilter.trim()) {
        const cleanTarget = delOrderNumberFilter.trim().toLowerCase().replace('#', '');
        const orderNum = (d.orderNumber || '').toLowerCase().replace('#', '');
        const delId = d.id.toLowerCase();
        if (!orderNum.includes(cleanTarget) && !delId.includes(cleanTarget)) return false;
      }

      if (delSearchQuery) {
        const q = delSearchQuery.toLowerCase().trim();
        const orderNum = (d.orderNumber || '').toLowerCase();
        const rName = (rider?.name || '').toLowerCase();
        const eName = (est?.name || '').toLowerCase();
        const matchNum = orderNum.includes(q.replace('#', ''));
        if (!matchNum && !rName.includes(q) && !eName.includes(q)) return false;
      }

      if (delRiderFilter !== 'all' && d.riderId !== delRiderFilter) return false;
      if (delEstFilter !== 'all' && d.establishmentId !== delEstFilter) return false;
      if (delStatusFilter !== 'all' && d.status !== delStatusFilter) return false;

      if (delFilterMode === 'smart_shift') {
        if (!delSmartDate) return true;
        const opDate = getDeliveryOperationalDate(d.date, d.time);
        const isDateMatch = isSameDayString(opDate, delSmartDate);
        if (!isDateMatch) return false;

        const [h] = (d.time || '12:00').split(':').map(Number);
        if (delSmartPeriod === 'night_shift') {
          return h >= 18 || h < 3;
        } else if (delSmartPeriod === 'morning_shift') {
          return h >= 6 && h < 12;
        } else if (delSmartPeriod === 'afternoon_shift') {
          return h >= 12 && h < 18;
        }
        return true;
      } else if (delFilterMode === 'date_range') {
        if (delDateFrom && d.date < delDateFrom) return false;
        if (delDateTo && d.date > delDateTo) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (delSortOrder === 'order_number_grouped') {
        const numA = parseInt((a.orderNumber || '0').replace(/\D/g, '') || '0', 10);
        const numB = parseInt((b.orderNumber || '0').replace(/\D/g, '') || '0', 10);
        if (numA !== numB) return numB - numA;
        return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
      }
      if (delSortOrder === 'date_desc') return b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.id.localeCompare(a.id);
      if (delSortOrder === 'date_asc') return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id);
      if (delSortOrder === 'value_desc') return Number(b.value || 0) - Number(a.value || 0);
      if (delSortOrder === 'value_asc') return Number(a.value || 0) - Number(b.value || 0);
      if (delSortOrder === 'rider_name') {
        const rA = users.find(u => u.id === a.riderId)?.name || '';
        const rB = users.find(u => u.id === b.riderId)?.name || '';
        return rA.localeCompare(rB);
      }
      if (delSortOrder === 'est_name') {
        const eA = establishments.find(e => e.id === a.establishmentId)?.name || '';
        const eB = establishments.find(e => e.id === b.establishmentId)?.name || '';
        return eA.localeCompare(eB);
      }
      return 0;
    });

  const pendingRequestsCount = partnerRequests.filter(r => r.status === 'pending').length;
  const pendingUsersCount = users.filter(u => !u.active).length;
  const pendingDeliveries = deliveries.filter(d => d.status === 'pending');

  const activeDeliveriesToday = deliveries.filter(d => d.date === todayStr && d.status === 'active');
  const totalRevenueToday = activeDeliveriesToday.reduce((sum, d) => sum + d.value, 0);
  const activeRidersCount = users.filter(u => u.role === 'rider' && u.active).length;
  const activeEstsCount = establishments.filter(e => e.active).length;

  const activeNotesDelivery = db.getDeliveries().find(d => d.id === notesDeliveryId) || null;
  const activeScheduleChat = schedules.find(s => s.id === activeScheduleChatId) || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      <ChatToastBanner toast={activeToast} onClose={() => setActiveToast(null)} />

      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Bike className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Painel Administrativo</h1>
              <p className="text-xs text-slate-400 hidden sm:block">Gestão de Escalas e Entregas</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSyncToSupabase}
              disabled={isSyncingSupabase}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center space-x-1 transition-colors shadow-sm"
              title="Sincronizar todas as corridas locais para a nuvem Supabase"
            >
              {isSyncingSupabase ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4 text-white" />
                  <span className="hidden sm:inline">Sincronizar c/ Supabase</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowBatchModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center space-x-1 transition-colors shadow-sm"
              title="Lançar múltiplas corridas de uma vez"
            >
              <Layers className="h-4 w-4 text-white" />
              <span className="hidden sm:inline">Lançamento em Lote</span>
            </button>
            <span className="text-sm text-slate-300 hidden md:inline">Olá, {adminUser?.name}</span>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors flex items-center space-x-1 text-sm text-red-400"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Sidebar Navigation */}
        <div className="hidden lg:block lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-fit space-y-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'overview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'map' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MapIcon className="h-5 w-5 text-emerald-600" />
            <span>Mapa GPS ao Vivo</span>
          </button>

          <button
            onClick={() => { setActiveTab('users'); setSearchQuery(''); setStatusFilter('all'); setRoleFilter('all'); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5" />
              <span>Usuários</span>
            </div>
            {pendingUsersCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {pendingUsersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('establishments'); setSearchQuery(''); setStatusFilter('all'); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'establishments' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Store className="h-5 w-5" />
            <span>Estabelecimentos</span>
          </button>

          <button
            onClick={() => { setActiveTab('requests'); setSearchQuery(''); setRequestStatusFilter('all'); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'requests' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Building2 className="h-5 w-5" />
              <span>Solicitações</span>
            </div>
            {pendingRequestsCount > 0 && (
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('schedules'); setSearchQuery(''); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'schedules' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Calendar className="h-5 w-5" />
            <span>Escalas</span>
          </button>

          <button
            onClick={() => { setActiveTab('deliveries'); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'deliveries' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Bike className="h-5 w-5" />
              <span>Corridas</span>
            </div>
            {pendingDeliveries.length > 0 && (
              <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {pendingDeliveries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'finance' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <span>Fechamento</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'reports' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Relatórios</span>
          </button>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden grid grid-cols-4 sm:grid-cols-8 gap-1 bg-white p-2 rounded-xl border border-slate-200">
          <button onClick={() => setActiveTab('overview')} className={`p-2 text-xs text-center rounded ${activeTab === 'overview' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}>Visão</button>
          <button onClick={() => setActiveTab('map')} className={`p-2 text-xs text-center rounded ${activeTab === 'map' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}>GPS</button>
          <button onClick={() => setActiveTab('users')} className={`p-2 text-xs text-center rounded ${activeTab === 'users' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}>Usuários</button>
          <button onClick={() => setActiveTab('establishments')} className={`p-2 text-xs text-center rounded ${activeTab === 'establishments' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}>Lojas</button>
          <button onClick={() => setActiveTab('requests')} className={`p-2 text-xs text-center rounded relative ${activeTab === 'requests' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}>Pedidos</button>
          <button onClick={() => setActiveTab('schedules')} className={`p-2 text-xs text-center rounded ${activeTab === 'schedules' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}>Escalas</button>
          <button onClick={() => setActiveTab('deliveries')} className={`p-2 text-xs text-center rounded ${activeTab === 'deliveries' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}>Corridas</button>
          <button onClick={() => setActiveTab('finance')} className={`p-2 text-xs text-center rounded ${activeTab === 'finance' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600'}`}>Fechamento</button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">Faturamento Hoje</p>
                    <p className="text-2xl font-bold text-slate-800">R$ {totalRevenueToday.toFixed(2)}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Bike className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">Corridas Hoje</p>
                    <p className="text-2xl font-bold text-slate-800">{activeDeliveriesToday.length}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">Motoboys Ativos</p>
                    <p className="text-2xl font-bold text-slate-800">{activeRidersCount}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                    <Store className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">Parceiros Ativos</p>
                    <p className="text-2xl font-bold text-slate-800">{activeEstsCount}</p>
                  </div>
                </div>
              </div>

              {/* Ações Administrativas Rápidas */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-red-600" />
                  <span>Ações de Manutenção e Sincronização</span>
                </h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSyncToSupabase}
                    disabled={isSyncingSupabase}
                    className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-xs font-black transition-all shadow-md"
                  >
                    {isSyncingSupabase ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>SINCRONIZANDO COM SUPABASE...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4 text-white" />
                        <span>SINCRONIZAR CORRIDAS COM SUPABASE</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl text-xs font-black transition-all shadow-md"
                    title="Lançamento rápido de corridas em lote"
                  >
                    <Layers className="h-4 w-4 text-white" />
                    <span>LANÇAMENTO EM LOTE</span>
                  </button>

                  <button
                    onClick={handleApproveAllPendingDeliveries}
                    className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl text-xs font-black transition-all shadow-sm"
                  >
                    <CheckCheck className="h-4 w-4" />
                    <span>APROVAR TODAS AS PENDENTES</span>
                  </button>

                  <button
                    onClick={handleZeroOutAllDeliveries}
                    className="flex items-center space-x-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-xs font-black transition-all shadow-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>ZERAR TODAS AS CORRIDAS E VALORES</span>
                  </button>
                </div>
              </div>

              {pendingDeliveries.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-bold text-amber-900 flex items-center gap-2 text-sm">
                      <Clock className="h-5 w-5 text-amber-600" />
                      Corridas Pendentes de Aprovação ({pendingDeliveries.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-amber-200/60">
                    {pendingDeliveries.map(del => {
                      const rider = users.find(u => u.id === del.riderId);
                      const est = establishments.find(e => e.id === del.establishmentId);
                      const repeatCount = getOrderRepeatCount(del);

                      return (
                        <div key={del.id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {del.orderNumber && (
                                <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                                  #{del.orderNumber}
                                </span>
                              )}
                              <p className="text-xs font-bold text-slate-800">{rider?.name} — {est?.name}</p>
                              {repeatCount > 1 && (
                                <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs border border-amber-600 animate-pulse">
                                  <Copy className="h-2.5 w-2.5" />
                                  <span>Nº Repetido ({repeatCount}x)</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{del.date} às {del.time} • R$ {del.value.toFixed(2)}</p>
                            {renderPaymentBadge(del)}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button onClick={() => handleApproveDelivery(del.id)} className="px-2.5 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700">Aprovar</button>
                            <button onClick={() => handleRejectDelivery(del.id)} className="px-2.5 py-1.5 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200">Rejeitar</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MAPA GPS AO VIVO NO ADMIN */}
          {activeTab === 'map' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <MapIcon className="h-6 w-6 text-emerald-600" />
                    <span>Monitoramento GPS de Entregadores em Tempo Real</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{onlineRiderLocations.length} motoboy(s) online com sinal GPS ativo</p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRecenterMap}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-3 py-2 rounded-lg border border-indigo-100 flex items-center gap-1.5 shadow-sm"
                    title="Centralizar e ver todos os motoboys"
                  >
                    <LocateFixed className="h-4 w-4" />
                    <span>Ver Todos</span>
                  </button>
                  <button
                    onClick={() => setIsMapExpanded(!isMapExpanded)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                    title="Expandir Tela Cheia"
                  >
                    {isMapExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className={isMapExpanded ? "fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] bg-slate-900 p-3 sm:p-5 flex flex-col space-y-3" : "w-full h-[550px] rounded-xl border border-slate-200 overflow-hidden relative"}>
                {isMapExpanded && (
                  <div className="flex items-center justify-between bg-slate-800 text-white px-4 py-3 rounded-2xl border border-slate-700 flex-shrink-0 shadow-lg z-10">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-600 rounded-xl text-white">
                        <MapIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm sm:text-base">Monitoramento GPS - Tela Cheia</h3>
                        <p className="text-xs text-slate-400">{onlineRiderLocations.length} motoboy(s) online com sinal GPS ativo</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleRecenterMap}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                      >
                        <LocateFixed className="h-4 w-4" />
                        <span>Centralizar</span>
                      </button>
                      <button
                        onClick={() => setIsMapExpanded(false)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <Minimize2 className="h-4 w-4" />
                        <span>Sair da Tela Cheia</span>
                      </button>
                    </div>
                  </div>
                )}
                <div ref={mapContainerRef} className="w-full h-full rounded-xl overflow-hidden" />
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Gerenciamento de Usuários</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleOpenDesignateModal()}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    <UserCheck2 className="h-4 w-4" />
                    <span>Designar Motoboy</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setUserForm({ name: '', cpf: '', phone: '', email: '', role: 'rider', password: '', establishmentId: '', establishmentName: '', zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '' });
                      setShowUserModal(true);
                    }}
                    className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Cadastrar Usuário</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Todas as Funções</option>
                  <option value="rider">Motoboys</option>
                  <option value="establishment">Gerentes de Estabelecimento</option>
                  <option value="admin">Administradores</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Todos os Status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos / Pendentes</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Nome</th>
                      <th className="p-3">Função</th>
                      <th className="p-3">Telefone / CPF</th>
                      <th className="p-3">E-mail</th>
                      <th className="p-3">Senha</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{u.name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'establishment' ? 'bg-blue-100 text-blue-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {u.role === 'admin' ? 'Admin' : u.role === 'establishment' ? 'Gerente' : 'Motoboy'}
                          </span>
                        </td>
                        <td className="p-3">{u.phone}<br/><span className="text-[10px] text-slate-400">{u.cpf}</span></td>
                        <td className="p-3">{u.email}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 font-mono">
                            <span>{visiblePasswords[u.id] ? u.passwordHash : '••••••••'}</span>
                            <button onClick={() => togglePasswordVisibility(u.id)} className="text-slate-400 hover:text-slate-600">
                              {visiblePasswords[u.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <button onClick={() => toggleUserStatus(u.id)} className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {u.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button onClick={() => handleQuickResetPassword(u)} className="p-1 text-amber-600 hover:bg-amber-50 rounded" title="Redefinir Senha">
                            <KeyRound className="h-4 w-4" />
                          </button>
                          {u.role === 'rider' && u.active && (
                            <button 
                              onClick={() => handleOpenDesignateModal(u.id)} 
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[11px] font-bold" 
                              title="Designar para Estabelecimento"
                            >
                              Designar
                            </button>
                          )}
                          {!u.active && (
                            <button onClick={() => handleApproveRider(u.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Aprovar">
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => {
                            setEditingUser(u);
                            setUserForm({
                              name: u.name, cpf: u.cpf, phone: u.phone, email: u.email, role: u.role, password: '', establishmentId: u.establishmentId || '', establishmentName: '', zipCode: '', street: '', number: '', neighborhood: '', city: '', state: ''
                            });
                            setShowUserModal(true);
                          }} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Editar">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteUser(u.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'establishments' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Estabelecimentos Parceiros</h2>
                <button
                  onClick={() => {
                    setEditingEst(null);
                    setEstForm({ name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', phone: '', email: '', password: '' });
                    setShowEstModal(true);
                  }}
                  className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Cadastrar Estabelecimento</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredEsts.map(e => {
                  const managerUser = users.find(u => u.establishmentId === e.id || (u.role === 'establishment' && e.email && u.email.toLowerCase() === e.email.toLowerCase()));

                  return (
                    <div key={e.id} className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-slate-800 text-base">{e.name}</h3>
                        <button onClick={() => toggleEstStatus(e.id)} className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${e.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {e.active ? 'Ativo' : 'Inativo'}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {e.address?.street}, {e.address?.number} - {e.address?.neighborhood}, {e.address?.city}/{e.address?.state}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {e.phone}
                      </p>
                      {managerUser && (
                        <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          <span>Login Gerente: {managerUser.email}</span>
                        </p>
                      )}
                      <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                        <button onClick={() => handleOpenDesignateModal(undefined, e.id)} className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
                          Designar Motoboy
                        </button>
                        <button onClick={() => {
                          setEditingEst(e);
                          setEstForm({
                            name: e.name,
                            street: e.address?.street || '',
                            number: e.address?.number || '',
                            complement: e.address?.complement || '',
                            neighborhood: e.address?.neighborhood || '',
                            city: e.address?.city || '',
                            state: e.address?.state || '',
                            zipCode: e.address?.zipCode || '',
                            phone: e.phone || '',
                            email: e.email || managerUser?.email || '',
                            password: ''
                          });
                          setShowEstModal(true);
                        }} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-bold">
                          Editar
                        </button>
                        <button onClick={() => handleDeleteEst(e.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-bold">
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Solicitações de Parceria</h2>
              <div className="divide-y divide-slate-100">
                {filteredRequests.map(req => (
                  <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-800">{req.establishmentName}</h3>
                      <p className="text-xs text-slate-500">Contato: {req.ownerName} ({req.phone})</p>
                      <p className="text-xs text-slate-400 mt-0.5">{req.address}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleContactRequest(req)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-bold">
                        WhatsApp
                      </button>
                      <button onClick={() => handleApproveRequest(req)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold">
                        Aprovar
                      </button>
                      <button onClick={() => handleDeleteRequest(req.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'schedules' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-indigo-600" />
                    <span>Gerenciamento de Escalas de Motoboys</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Aloque um ou mais motoboys para os estabelecimentos por dia e turno</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleOpenDesignateModal()}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-md hover:shadow-lg"
                  >
                    <UserCheck2 className="h-4 w-4" />
                    <span>Designar Motoboy(s)</span>
                  </button>
                  <button
                    onClick={() => {
                      const activeRiders = users.filter(r => r.role === 'rider' && r.active);
                      setWeeklyForm({ 
                        riderId: activeRiders.length > 0 ? activeRiders[0].id : '', 
                        establishmentId: '', 
                        shift: 'morning', 
                        startTime: '08:00', 
                        endTime: '12:00', 
                        weekStart: getThisMonday(), 
                        days: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false } 
                      });
                      setWeeklySelectedRiderIds([]);
                      setWeeklyStep('form');
                      setShowWeeklyModal(true);
                    }}
                    className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span>Escala Semanal</span>
                  </button>
                </div>
              </div>

              {/* PAINEL DE FILTROS DAS ESCALAS */}
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase text-slate-600 flex items-center gap-1.5">
                    <Filter className="h-4 w-4 text-indigo-600" />
                    <span>Filtros e Visualização das Escalas</span>
                  </p>

                  {(schRiderFilter !== 'all' || schEstFilter !== 'all' || schShiftFilter !== 'all' || schTimeframeFilter !== 'all' || schSpecificDate || searchQuery) && (
                    <button
                      onClick={() => {
                        setSchRiderFilter('all');
                        setSchEstFilter('all');
                        setSchShiftFilter('all');
                        setSchTimeframeFilter('all');
                        setSchSpecificDate('');
                        setSearchQuery('');
                      }}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Motoboy</label>
                    <select
                      value={schRiderFilter}
                      onChange={(e) => setSchRiderFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Todos os Motoboys</option>
                      {users.filter(u => u.role === 'rider').map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
                    <select
                      value={schEstFilter}
                      onChange={(e) => setSchEstFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Todos os Estabelecimentos</option>
                      {establishments.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Turno</label>
                    <select
                      value={schShiftFilter}
                      onChange={(e) => setSchShiftFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Todos os Turnos</option>
                      <option value="morning">Manhã</option>
                      <option value="afternoon">Tarde</option>
                      <option value="night">Noite</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Período de Data</label>
                    <select
                      value={schTimeframeFilter}
                      onChange={(e) => setSchTimeframeFilter(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      <option value="all">Todas as Datas</option>
                      <option value="today">Somente Hoje (Turno Atual)</option>
                      <option value="upcoming">Escalas Futuras</option>
                      <option value="past">Concluídas / Passadas</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Específica</label>
                    <input
                      type="date"
                      value={schSpecificDate}
                      onChange={(e) => setSchSpecificDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <ArrowUpDown className="h-3 w-3 text-indigo-600" />
                      <span>Classificação / Ordenação</span>
                    </label>
                    <select
                      value={schSortOrder}
                      onChange={(e) => setSchSortOrder(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700"
                    >
                      <option value="date_desc">Mais Recentes Primeiro</option>
                      <option value="date_asc">Mais Antigas Primeiro</option>
                      <option value="rider_name">Classificar por Nome do Motoboy</option>
                      <option value="est_name">Classificar por Nome do Estabelecimento</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center px-1 text-xs text-slate-500 font-semibold">
                <span>{filteredAndSortedSchedules.length} escala(s) encontrada(s)</span>
              </div>

              {filteredAndSortedSchedules.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <Calendar className="h-10 w-10 mx-auto text-slate-300" />
                  <p className="text-sm font-medium">Nenhuma escala encontrada com os filtros selecionados.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredAndSortedSchedules.map(sch => {
                    const rider = users.find(u => u.id === sch.riderId);
                    const est = establishments.find(e => e.id === sch.establishmentId);
                    const isToday = sch.date === todayStr;

                    return (
                      <div key={sch.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 p-2 rounded-xl transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isToday && (
                              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                HOJE
                              </span>
                            )}
                            <p className="font-extrabold text-slate-800 text-sm">
                              {rider?.name || 'Motoboy'} 
                              <span className="text-slate-400 font-normal"> em </span> 
                              <span className="text-indigo-600">{est?.name || 'Estabelecimento'}</span>
                            </p>
                          </div>
                          
                          <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="font-semibold text-slate-700">{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                            <span className="text-slate-300">•</span>
                            <span className={`font-bold ${
                              sch.shift === 'morning' ? 'text-amber-600' :
                              sch.shift === 'afternoon' ? 'text-orange-600' : 'text-blue-600'
                            }`}>
                              Turno da {getShiftLabel(sch.shift)}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[11px]">{sch.startTime} - {sch.endTime}</span>
                          </p>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-center">
                          <button 
                            onClick={() => setActiveScheduleChatId(sch.id)} 
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors" 
                            title="Chat do Turno"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Chat</span>
                          </button>
                          <button 
                            onClick={() => handleCancelSchedule(sch.id)} 
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                            title="Cancelar Escala"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Bike className="h-6 w-6 text-indigo-600" />
                    <span>Registro e Controle de Corridas ({filteredAndSortedDeliveries.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Visualize, filtre e gerencie todas as entregas do sistema</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md hover:shadow-lg"
                  >
                    <Layers className="h-4 w-4 text-white" />
                    <span>Lançamento em Lote</span>
                  </button>

                  {pendingDeliveries.length > 0 && (
                    <button
                      onClick={handleApproveAllPendingDeliveries}
                      className="flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-md hover:shadow-lg"
                    >
                      <CheckCheck className="h-4 w-4" />
                      <span>Aprovar Múltiplas ({pendingDeliveries.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingDelivery(null);
                      setDeliveryForm({ riderId: '', establishmentId: '', date: db.getOperationalDateString(), time: new Date().toTimeString().slice(0,5), value: '', orderNumber: '', notes: '', deliveryType: 'standard', additionalValue: '', additionalReason: '', linkedOrderNumber: '', paymentMethod: 'already_paid', orderCollectionAmount: '', changeFor: '' });
                      setShowDeliveryModal(true);
                    }}
                    className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Lançar Nova Corrida</span>
                  </button>
                </div>
              </div>

              {/* CARD DE FILTROS DE CORRIDAS */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                  <p className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5 tracking-wider">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span>FILTRO DE TURNO E PERÍODO</span>
                  </p>

                  <div className="flex items-center space-x-2">
                    <select
                      value={delFilterMode}
                      onChange={(e) => setDelFilterMode(e.target.value as any)}
                      className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-900 rounded-xl text-xs font-extrabold shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="smart_shift">✨ Turno Inteligente por Data</option>
                      <option value="date_range">📅 Intervalo de Datas</option>
                      <option value="all">🌐 Todas as Corridas</option>
                    </select>
                  </div>
                </div>

                {delFilterMode === 'smart_shift' && (
                  <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-950 uppercase">
                        Selecione o Turno:
                      </label>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={setDelSmartDateToToday}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                        >
                          Hoje
                        </button>
                        <button
                          type="button"
                          onClick={setDelSmartDateToYesterday}
                          className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                        >
                          Ontem
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">DATA BASE</label>
                        <input
                          type="date"
                          value={delSmartDate}
                          onChange={(e) => setDelSmartDate(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">PERÍODO / EXPEDIENTE</label>
                        <select
                          value={delSmartPeriod}
                          onChange={(e) => setDelSmartPeriod(e.target.value as any)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="all_shifts">Turno Completo (Manhã + Tarde + Noite/Madrugada)</option>
                          <option value="night_shift">Turno Noite / Madrugada (18h00 às 02h59)</option>
                          <option value="morning_shift">Turno Manhã (06h00 às 11h59)</option>
                          <option value="afternoon_shift">Turno Tarde (12h00 às 17h59)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {delFilterMode === 'date_range' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">De (Data Inicial)</label>
                      <input
                        type="date"
                        value={delDateFrom}
                        onChange={(e) => setDelDateFrom(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Até (Data Final)</label>
                      <input
                        type="date"
                        value={delDateTo}
                        onChange={(e) => setDelDateTo(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 border-t border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1 flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      <span>Nº da Corrida</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: 1042"
                        value={delOrderNumberFilter}
                        onChange={(e) => setDelOrderNumberFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-indigo-200 bg-indigo-50/50 rounded-lg text-xs font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <Hash className="h-3.5 w-3.5 text-indigo-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-amber-800 uppercase mb-1 flex items-center gap-1">
                      <Banknote className="h-3 w-3 text-amber-600" />
                      <span>Cobrar do Cliente</span>
                    </label>
                    <select
                      value={delPaymentFilter}
                      onChange={(e) => setDelPaymentFilter(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-amber-300 bg-amber-50/80 rounded-lg text-xs font-extrabold text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-xs"
                    >
                      <option value="all">Todos os Pagamentos</option>
                      <option value="to_collect">💰 Cobrar na Entrega (Todos)</option>
                      <option value="money">💵 Dinheiro (com Troco)</option>
                      <option value="card">💳 Cartão (Débito/Crédito)</option>
                      <option value="pix">📱 PIX na Entrega</option>
                      <option value="already_paid">🟢 Já Pago (Online)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-purple-700 uppercase mb-1 flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      <span>Tipo / Agrupamento</span>
                    </label>
                    <select
                      value={delFeatureFilter}
                      onChange={(e) => setDelFeatureFilter(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-purple-300 bg-purple-50/50 rounded-lg text-xs font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="all">Todos os Tipos</option>
                      <option value="same_order_number">👯‍♂️ Pedidos com Mesmo Nº (Repetidos)</option>
                      <option value="with_additional">✨ Com Adicional</option>
                      <option value="linked">🔗 Vinculadas (Mesmo Endereço)</option>
                      <option value="standard">Padrão (Sem Adicional/Vínculo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span>Filtro de Observações</span>
                    </label>
                    <select
                      value={delNotesFilter}
                      onChange={(e) => setDelNotesFilter(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-amber-300 bg-amber-50/50 rounded-lg text-xs font-bold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="all">Todas as Corridas</option>
                      <option value="with_notes">💬 Somente COM Observações</option>
                      <option value="without_notes">Sem Observações</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Motoboy</label>
                    <select
                      value={delRiderFilter}
                      onChange={(e) => setDelRiderFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Todos os Motoboys</option>
                      {users.filter(u => u.role === 'rider').map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
                    <select
                      value={delEstFilter}
                      onChange={(e) => setDelEstFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Todos os Estabelecimentos</option>
                      {establishments.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buscar por Nome / Loja</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: João, Burgrill..."
                        value={delSearchQuery}
                        onChange={(e) => setDelSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status da Corrida</label>
                    <select
                      value={delStatusFilter}
                      onChange={(e) => setDelStatusFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                    >
                      <option value="all">Todos os Status</option>
                      <option value="active">Aprovadas (Ativas)</option>
                      <option value="pending">Pendentes de Aprovação</option>
                      <option value="rejected">Rejeitadas</option>
                      <option value="cancelled">Canceladas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <ArrowUpDown className="h-3 w-3 text-indigo-600" />
                      <span>Classificação / Mecanismo</span>
                    </label>
                    <select
                      value={delSortOrder}
                      onChange={(e) => setDelSortOrder(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700"
                    >
                      <option value="date_desc">Mais Recentes Primeiro</option>
                      <option value="date_asc">Mais Antigas Primeiro</option>
                      <option value="order_number_grouped">👯‍♂️ Agrupar por Nº do Pedido (Mesmo Nº)</option>
                      <option value="value_desc">Maior Valor (R$)</option>
                      <option value="value_asc">Menor Valor (R$)</option>
                      <option value="rider_name">Nome do Motoboy (A-Z)</option>
                      <option value="est_name">Nome do Estabelecimento (A-Z)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* LISTA DE CORRIDAS */}
              {filteredAndSortedDeliveries.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <Bike className="h-10 w-10 mx-auto text-slate-300" />
                  <p className="text-sm font-medium">Nenhuma corrida encontrada com os filtros selecionados.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredAndSortedDeliveries.map(del => {
                    const rider = users.find(u => u.id === del.riderId);
                    const est = establishments.find(e => e.id === del.establishmentId);
                    const isPending = del.status === 'pending';
                    const hasNotes = Boolean(del.notes && del.notes.trim());
                    const notesCount = del.notes ? del.notes.split('\n').filter(l => l.trim()).length : 0;
                    const isSame = del.deliveryType === 'same_address';
                    const hasAdditional = Number(del.additionalValue || 0) > 0;
                    const repeatCount = getOrderRepeatCount(del);

                    return (
                      <div key={del.id} className={`py-3.5 flex flex-col space-y-1.5 hover:bg-slate-50/60 p-2 rounded-xl transition-colors ${repeatCount > 1 ? 'border-l-4 border-l-amber-500 bg-amber-50/20' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {del.orderNumber && (
                                <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex-shrink-0 tracking-wide">
                                  #{del.orderNumber}
                                </span>
                              )}
                              <p className="font-extrabold text-slate-800 text-sm">{rider?.name || 'Motoboy'}</p>
                              <span className="text-xs text-slate-500 font-medium">• {est?.name || 'Estabelecimento'}</span>
                              
                              {/* Badge de Repetição do mesmo número de pedido */}
                              {repeatCount > 1 && (
                                <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs border border-amber-600 animate-pulse">
                                  <Copy className="h-3 w-3" />
                                  <span>Nº Repetido ({repeatCount}x)</span>
                                </span>
                              )}

                              {/* Badge Mesmo Endereço com Vinculação */}
                              {isSame && (
                                <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                  <Link2 className="h-3 w-3" />
                                  <span>Mesmo Endereço {del.linkedOrderNumber ? `(#${del.linkedOrderNumber})` : ''}</span>
                                </span>
                              )}

                              {/* Badge Valor Adicional com Motivo */}
                              {hasAdditional && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Sparkles className="h-3 w-3 text-amber-600" />
                                  <span>
                                    + R$ {Number(del.additionalValue).toFixed(2)}
                                    {del.additionalReason ? ` (${del.additionalReason})` : ' Extra'}
                                  </span>
                                </span>
                              )}

                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                del.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                del.status === 'pending' ? 'bg-amber-100 text-amber-800 font-black animate-pulse' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {del.status === 'active' ? 'Aprovada' : del.status === 'pending' ? 'Pendente' : 'Rejeitada'}
                              </span>
                              {del.paid && (
                                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                                  Pago
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                              <span>{new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono">{del.time}</span>
                              <span className="text-slate-300">•</span>
                              <span>Valor: <strong className="text-emerald-600 font-black">R$ {del.value.toFixed(2)}</strong></span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 justify-between sm:justify-end flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleApproveDelivery(del.id)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                                  title="Aprovar Corrida"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Aprovar</span>
                                </button>
                                <button
                                  onClick={() => handleRejectDelivery(del.id)}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                  title="Recusar Corrida com Justificativa"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  <span>Recusar</span>
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => setNotesDeliveryId(del.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                                hasNotes 
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 shadow-sm' 
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                              }`}
                              title="Observações e Chat da Corrida"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Observações</span>
                              {hasNotes && (
                                <span className="bg-amber-950 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                  {notesCount}
                                </span>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                setEditingDelivery(del);
                                setDeliveryForm({
                                  riderId: del.riderId,
                                  establishmentId: del.establishmentId,
                                  date: del.date,
                                  time: del.time,
                                  value: del.value.toString(),
                                  orderNumber: del.orderNumber || '',
                                  notes: del.notes || '',
                                  deliveryType: del.deliveryType || 'standard',
                                  additionalValue: del.additionalValue ? del.additionalValue.toString() : '',
                                  additionalReason: del.additionalReason || '',
                                  linkedOrderNumber: del.linkedOrderNumber || '',
                                  paymentMethod: del.paymentMethod || 'already_paid',
                                  orderCollectionAmount: del.orderCollectionAmount ? del.orderCollectionAmount.toString() : '',
                                  changeFor: del.changeFor ? del.changeFor.toString() : ''
                                });
                                setShowDeliveryModal(true);
                              }}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              title="Editar Corrida"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteDelivery(del.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                              title="Excluir Corrida"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* SINALIZAÇÃO VISUAL DE COBRANÇA NA ENTREGA */}
                        {renderPaymentBadge(del)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA FECHAMENTO FINANCEIRO REORGANIZADA COM DIVISÃO DE GANHOS E 5 MÉTRICAS */}
          {activeTab === 'finance' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              
              {/* Header do Fechamento */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Wallet className="h-6 w-6 text-emerald-600" />
                    <span>Fechamento Financeiro & Repasse</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Discriminação detalhada: Ganho do Motoboy vs Taxa do Administrador (R$ 1,00/corrida padrão | R$ 0,00 para mesmo endereço a R$ 4,00)
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setFinanceActiveSection('riders')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      financeActiveSection === 'riders' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Bike className="h-4 w-4" />
                    <span>Por Motoboy</span>
                  </button>
                  <button
                    onClick={() => setFinanceActiveSection('establishments')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      financeActiveSection === 'establishments' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Store className="h-4 w-4" />
                    <span>Por Estabelecimento</span>
                  </button>
                </div>
              </div>

              {/* FILTROS DO FECHAMENTO */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                  <span className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5 tracking-wider">
                    <Filter className="h-4 w-4 text-indigo-600" />
                    <span>Filtros do Fechamento: {financeBounds.label}</span>
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-bold">Status:</span>
                    <select
                      value={financePaidFilter}
                      onChange={(e) => setFinancePaidFilter(e.target.value as any)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="unpaid">⏳ A Pagar / Pendentes de Baixa</option>
                      <option value="paid">✅ Já Pagas / Baixadas</option>
                      <option value="all">🌐 Todas as Corridas</option>
                    </select>

                    <select
                      value={financePaymentFilter}
                      onChange={(e) => setFinancePaymentFilter(e.target.value as any)}
                      className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="all">Todos Pagamentos</option>
                      <option value="to_collect">💰 Cobrar na Entrega</option>
                      <option value="money">💵 Dinheiro</option>
                      <option value="card">💳 Cartão</option>
                      <option value="pix">📱 PIX</option>
                      <option value="already_paid">🟢 Já Pago</option>
                    </select>

                    <select
                      value={financeFeatureFilter}
                      onChange={(e) => setFinanceFeatureFilter(e.target.value as any)}
                      className="px-2.5 py-1 bg-white border border-purple-300 rounded-lg text-xs font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="all">Todos os Tipos</option>
                      <option value="same_order_number">👯‍♂️ Pedidos com Mesmo Nº (Repetidos)</option>
                      <option value="with_additional">✨ Com Adicional</option>
                      <option value="linked">🔗 Vinculadas</option>
                      <option value="standard">Padrão</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setFinancePeriodMode('this_week')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      financePeriodMode === 'this_week' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    📅 Esta Semana
                  </button>

                  <button
                    type="button"
                    onClick={() => setFinancePeriodMode('last_week')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      financePeriodMode === 'last_week' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⏮️ Semana Passada
                  </button>

                  <button
                    type="button"
                    onClick={() => setFinancePeriodMode('today')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      financePeriodMode === 'today' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⚡ Hoje (Turno)
                  </button>

                  <button
                    type="button"
                    onClick={() => setFinancePeriodMode('this_month')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      financePeriodMode === 'this_month' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    📆 Este Mês
                  </button>

                  <button
                    type="button"
                    onClick={() => setFinancePeriodMode('custom')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      financePeriodMode === 'custom' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🔍 Personalizado
                  </button>
                </div>

                {financePeriodMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Inicial</label>
                      <input
                        type="date"
                        value={financeCustomFrom}
                        onChange={(e) => setFinanceCustomFrom(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Final</label>
                      <input
                        type="date"
                        value={financeCustomTo}
                        onChange={(e) => setFinanceCustomTo(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CARDS DE MÉTRICAS CONSOLIDADAS DISCRIMINANDO TAXA ADM E GANHO MOTOBOY */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Total Bruto Faturado */}
                <div className="bg-slate-900 text-white p-4.5 rounded-2xl shadow-sm border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Bruto Faturado</span>
                    <Receipt className="h-4 w-4 text-indigo-400" />
                  </div>
                  <p className="text-2xl font-black tracking-tight text-white mt-1">
                    R$ {totalFinanceGrossRevenue.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {totalFinanceDeliveriesCount} corrida(s) no período
                  </p>
                </div>

                {/* Ganho Líquido Motoboys */}
                <div className="bg-emerald-50 border-2 border-emerald-300 p-4.5 rounded-2xl shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Repasse Líquido Motoboys</span>
                    <Bike className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-black tracking-tight text-emerald-700 mt-1">
                    R$ {totalFinanceRidersNet.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-emerald-800 font-bold">
                    R$ 7,00 por corrida padrão | R$ 4,00 integral
                  </p>
                </div>

                {/* Comissão do Administrador */}
                <div className="bg-amber-50 border-2 border-amber-300 p-4.5 rounded-2xl shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-amber-900">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Taxa Adm / Sistema</span>
                    <Coins className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="text-2xl font-black tracking-tight text-amber-800 mt-1">
                    R$ {totalFinanceAdminCommission.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-amber-800 font-bold">
                    R$ 1,00 por corrida padrão (R$ 4 isento)
                  </p>
                </div>

                {/* Total a Receber das Lojas */}
                <div className="bg-indigo-50 border-2 border-indigo-300 p-4.5 rounded-2xl shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-indigo-900">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Cobrança Estabelecimentos</span>
                    <Store className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="text-2xl font-black tracking-tight text-indigo-900 mt-1">
                    R$ {totalFinanceGrossRevenue.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-indigo-700 font-bold">
                    Valor total a acertar com lojas
                  </p>
                </div>

              </div>

              {/* SEÇÃO 1: FECHAMENTO POR MOTOBOY COM AS 5 MÉTRICAS */}
              {financeActiveSection === 'riders' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                      <Bike className="h-5 w-5 text-indigo-600" />
                      <span>Repasse Individual por Motoboy ({users.filter(u => u.role === 'rider').length})</span>
                    </h3>

                    <div className="w-full sm:w-64">
                      <input
                        type="text"
                        placeholder="Buscar motoboy por nome..."
                        value={financeRiderSearch}
                        onChange={(e) => setFinanceRiderSearch(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {users
                      .filter(u => u.role === 'rider')
                      .filter(r => r.name.toLowerCase().includes(financeRiderSearch.toLowerCase()) || r.phone.includes(financeRiderSearch))
                      .map(rider => {
                        const riderDeliveries = financeFilteredDeliveries.filter(d => d.riderId === rider.id);
                        const count = riderDeliveries.length;
                        const allPaid = count > 0 && riderDeliveries.every(d => d.paid);

                        return (
                          <RiderFinancialMetricsCard
                            key={rider.id}
                            riderName={rider.name}
                            riderPhone={rider.phone}
                            deliveries={riderDeliveries}
                            isPaid={allPaid}
                            showSettleButton={true}
                            onSettle={() => handleSettleRiderDeliveries(rider.id, riderDeliveries.map(d => d.id))}
                            onUnsettle={() => handleUnsettleRiderDeliveries(rider.id, riderDeliveries.map(d => d.id))}
                            periodLabel={financeBounds.label}
                          />
                        );
                      })}
                  </div>
                </div>
              )}

              {/* SEÇÃO 2: FECHAMENTO POR ESTABELECIMENTO */}
              {financeActiveSection === 'establishments' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                      <Store className="h-5 w-5 text-indigo-600" />
                      <span>Cobrança por Estabelecimento ({establishments.length})</span>
                    </h3>

                    <div className="w-full sm:w-64">
                      <input
                        type="text"
                        placeholder="Buscar loja por nome..."
                        value={financeEstSearch}
                        onChange={(e) => setFinanceEstSearch(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {establishments
                      .filter(e => e.name.toLowerCase().includes(financeEstSearch.toLowerCase()) || e.phone.includes(financeEstSearch))
                      .map(est => {
                        const estDeliveries = financeFilteredDeliveries.filter(d => d.establishmentId === est.id);
                        const count = estDeliveries.length;
                        const totalCharged = estDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
                        const adminCut = estDeliveries.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
                        const ridersCut = Math.max(0, totalCharged - adminCut);
                        const allSettled = count > 0 && estDeliveries.every(d => d.paid);

                        return (
                          <div 
                            key={est.id} 
                            className={`p-5 rounded-2xl border transition-all ${
                              count > 0 
                                ? allSettled 
                                  ? 'bg-slate-50 border-slate-200' 
                                  : 'bg-white border-indigo-200 shadow-sm hover:border-indigo-400' 
                                : 'bg-slate-50/50 border-slate-200 opacity-60'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-slate-900 text-base truncate">{est.name}</h4>
                                <p className="text-xs text-slate-500 truncate">{est.address?.street}, {est.address?.number} - {est.address?.neighborhood}</p>
                              </div>

                              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                count === 0 ? 'bg-slate-100 text-slate-500' :
                                allSettled ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
                              }`}>
                                {count === 0 ? 'Sem Corridas' : allSettled ? 'Recebido' : 'A Receber'}
                              </span>
                            </div>

                            {/* Detalhamento dos Valores */}
                            <div className="grid grid-cols-3 gap-2 pt-3.5 pb-2 text-center border-t border-slate-100 mt-3">
                              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                <p className="text-[9px] font-extrabold text-slate-400 uppercase">Corridas</p>
                                <p className="text-sm font-black text-slate-800 mt-0.5">{count}</p>
                              </div>
                              <div className="bg-emerald-50/60 rounded-xl p-2 border border-emerald-200">
                                <p className="text-[9px] font-extrabold text-emerald-800 uppercase">Repasse Motoboys</p>
                                <p className="text-sm font-black text-emerald-700 mt-0.5">R$ {ridersCut.toFixed(2)}</p>
                              </div>
                              <div className="bg-amber-50/60 rounded-xl p-2 border border-amber-200">
                                <p className="text-[9px] font-extrabold text-amber-800 uppercase">Sua Taxa (R$1)</p>
                                <p className="text-sm font-black text-amber-700 mt-0.5">R$ {adminCut.toFixed(2)}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                              <div>
                                <span className="text-slate-400 font-medium">Total a Cobrar: </span>
                                <strong className="text-indigo-900 font-black text-sm">R$ {totalCharged.toFixed(2)}</strong>
                              </div>

                              {count > 0 && !allSettled && (
                                <button
                                  onClick={() => handleSettleEstDeliveries(est.id, estDeliveries.map(d => d.id))}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-sm flex items-center gap-1"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Dar Baixa (Receber)</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'reports' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Relatórios Gerenciais</h2>
                <button onClick={exportToCSV} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold">
                  <Download className="h-4 w-4" />
                  <span>Exportar CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Relatório</label>
                  <select value={reportType} onChange={(e) => setReportType(e.target.value as any)} className="w-full p-2 border border-slate-300 rounded text-xs">
                    <option value="earnings">Faturamento por Motoboy</option>
                    <option value="deliveries">Quantidade de Corridas por Motoboy</option>
                    <option value="schedules">Escalas por Estabelecimento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Período</label>
                  <select value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value as any)} className="w-full p-2 border border-slate-300 rounded text-xs">
                    <option value="daily">Diário (Hoje)</option>
                    <option value="weekly">Semanal (Esta Semana)</option>
                    <option value="monthly">Mensal (Este Mês)</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>
              </div>

              {reportPeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="p-2 border rounded text-xs" />
                  <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="p-2 border rounded text-xs" />
                </div>
              )}

              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 font-bold uppercase border-b">
                    <tr>
                      <th className="p-3">Nome</th>
                      {reportType === 'earnings' && <th className="p-3">Total (R$)</th>}
                      <th className="p-3">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {getFilteredReportData().map((row: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-3 font-semibold text-slate-800">{row.name}</td>
                        {reportType === 'earnings' && <td className="p-3 font-bold text-emerald-600">R$ {row.total.toFixed(2)}</td>}
                        <td className="p-3">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <UserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        editingUser={editingUser}
        userForm={userForm}
        setUserForm={setUserForm}
        establishments={establishments}
        onSave={handleSaveUser}
      />

      <EstablishmentModal
        isOpen={showEstModal}
        onClose={() => setShowEstModal(false)}
        editingEst={editingEst}
        estForm={estForm}
        setEstForm={setEstForm}
        onSave={handleSaveEst}
      />

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        scheduleForm={scheduleForm}
        setScheduleForm={setScheduleForm}
        selectedRiderIds={selectedRiderIds}
        setSelectedRiderIds={setSelectedRiderIds}
        scheduleConflictWarning={scheduleConflictWarning}
        setScheduleConflictWarning={setScheduleConflictWarning}
        onSave={handleSaveSchedule}
      />

      <WeeklyScheduleModal
        isOpen={showWeeklyModal}
        onClose={() => setShowWeeklyModal(false)}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        weeklyForm={weeklyForm}
        setWeeklyForm={setWeeklyForm}
        weeklyPreview={weeklyPreview}
        setWeeklyPreview={setWeeklyPreview}
        weeklyStep={weeklyStep}
        setWeeklyStep={setWeeklyStep}
        buildWeeklyPreview={buildWeeklyPreview}
        onSave={handleSaveWeeklySchedule}
        getShiftLabel={getShiftLabel}
        selectedRiderIds={weeklySelectedRiderIds}
        setSelectedRiderIds={setWeeklySelectedRiderIds}
      />

      <RiderSchedulesModal
        riderId={riderSchedulesModal}
        onClose={() => setRiderSchedulesModal(null)}
        riders={users.filter(u => u.role === 'rider')}
        schedules={schedules}
        establishments={establishments}
        modalHistoryEst={modalHistoryEst}
        setModalHistoryEst={setModalHistoryEst}
        modalHistoryFrom={modalHistoryFrom}
        setModalHistoryFrom={setModalHistoryFrom}
        modalHistoryTo={modalHistoryTo}
        setModalHistoryTo={setModalHistoryTo}
        onCancelSchedule={handleCancelSchedule}
        onNewSchedule={(riderId) => {
          setRiderSchedulesModal(null);
          handleOpenDesignateModal(riderId);
        }}
        getShiftLabel={getShiftLabel}
      />

      <DeliveryModal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        editingDelivery={editingDelivery}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        deliveryForm={deliveryForm}
        setDeliveryForm={setDeliveryForm}
        onSave={handleSaveDelivery}
      />

      <BatchDeliveryModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        onSaved={loadData}
      />

      <DeliveryNotesModal
        isOpen={!!notesDeliveryId}
        onClose={() => setNotesDeliveryId(null)}
        delivery={activeNotesDelivery}
        userRole="admin"
        userName={adminUser?.name || 'Admin'}
        onSaveNotes={handleSaveNotes}
      />

      <ScheduleChatModal
        isOpen={!!activeScheduleChatId}
        onClose={() => setActiveScheduleChatId(null)}
        schedule={activeScheduleChat}
        userRole="admin"
        userName={adminUser?.name || 'Admin'}
        onSaveChat={handleSaveScheduleChat}
      />
    </div>
  );
}