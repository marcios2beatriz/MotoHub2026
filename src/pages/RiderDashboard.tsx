"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Schedule, Delivery, Notification, Establishment, RouteHistoryItem, getDeliveryOperationalDate, isSameDayString } from '../utils/db';
import { NEIGHBORHOOD_RATES } from '../utils/neighborhoods';
import { 
  DollarSign, 
  Calendar, 
  Bell, 
  LogOut, 
  TrendingUp, 
  CheckCircle, 
  MapPin, 
  Clock, 
  AlertCircle,
  History,
  X,
  Plus,
  Share2,
  MessageSquare,
  ShieldAlert,
  Check,
  Compass,
  Download,
  RotateCw,
  Sparkles,
  Filter,
  Hash,
  Link2,
  HelpCircle,
  Loader2,
  Wallet,
  Coins,
  Receipt,
  Search,
  Tag,
  CreditCard,
  Banknote,
  CheckCircle2,
  QrCode,
  Copy,
  ChevronDown
} from 'lucide-react';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import CustomerChatModal from '../components/CustomerChatModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import RiderNavigationMap from '../components/RiderNavigationMap';
import ChatToastBanner, { ChatToast } from '../components/ChatToastBanner';
import RiderFinancialMetricsCard from '../components/RiderFinancialMetricsCard';
import { sendDeviceNotification, playNotificationSound, requestNotificationPermission } from '../utils/notifications';
import { gpsTracker, GpsState } from '../utils/gpsTracker';

const ADMIN_FEE_PER_DELIVERY = 1.00;

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

const PAGE_SIZE = 30;

export default function RiderDashboard() {
  const navigate = useNavigate();
  const [user] = useState(db.getCurrentUser());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryItem[]>([]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'navigation' | 'schedules' | 'history' | 'earnings' | 'rates' | 'notifications'>('dashboard');
  const [historySubTab, setHistorySubTab] = useState<'deliveries' | 'routes'>('deliveries');

  const [historyDisplayLimit, setHistoryDisplayLimit] = useState(PAGE_SIZE);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeToast, setActiveToast] = useState<ChatToast | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [rateSearch, setRateSearch] = useState('');
  const [ratePriceFilter, setRatePriceFilter] = useState<number | 'all'>('all');

  const [gpsState, setGpsState] = useState<GpsState>({
    currentLocation: null,
    quality: 'off',
    errorMessage: null,
    isNavigating: false
  });

  const [navDestination, setNavDestination] = useState<{
    name: string;
    addressText: string;
    lat?: number;
    lng?: number;
  } | null>(null);
  
  const hasInitializedDestRef = useRef(false);

  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [launchForm, setLaunchForm] = useState({
    establishmentId: '',
    value: '8.00',
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

  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [customerChatDeliveryId, setCustomerChatDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  const [scheduleEstFilter, setScheduleEstFilter] = useState('');
  const [scheduleDateFilter, setScheduleDateFilter] = useState('');

  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<'all' | 'active' | 'pending' | 'rejected' | 'cancelled'>('all');
  const [deliveryFeatureFilter, setDeliveryFeatureFilter] = useState<'all' | 'same_order_number' | 'with_additional' | 'linked' | 'standard'>('all');

  const [filterMode, setFilterMode] = useState<'smart_shift' | 'date_range' | 'all'>('smart_shift');
  const [smartDate, setSmartDate] = useState<string>(db.getOperationalDateString());
  const [smartPeriod, setSmartPeriod] = useState<'all_shifts' | 'night_shift' | 'morning_shift' | 'afternoon_shift'>('all_shifts');
  
  const [historyEstFilter, setHistoryEstFilter] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyOrderNumberFilter, setHistoryOrderNumberFilter] = useState('');

  const [earningsPeriodMode, setEarningsPeriodMode] = useState<'this_week' | 'last_week' | 'today' | 'this_month' | 'custom'>('this_week');
  const [earningsCustomFrom, setEarningsCustomFrom] = useState<string>('');
  const [earningsCustomTo, setEarningsCustomTo] = useState<string>('');
  const [earningsPaidFilter, setEarningsPaidFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [earningsFeatureFilter, setEarningsFeatureFilter] = useState<'all' | 'same_order_number' | 'with_additional' | 'linked' | 'standard'>('all');
  const [earningsEstFilter, setEarningsEstFilter] = useState<string>('');

  const resolveEst = (id: string): Establishment | undefined => {
    return db.resolveEstablishment(id);
  };

  useEffect(() => {
    gpsTracker.startTracking();
    const unsubscribeGps = gpsTracker.subscribe((state) => {
      setGpsState(state);
    });
    return () => unsubscribeGps();
  }, []);

  const activePos = gpsState.currentLocation;

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPwa = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
    } else {
      alert('Para instalar o app e manter o GPS ativo em segundo plano:\n1. Toque nos 3 pontinhos do navegador\n2. Clique em "Adicionar à Tela Inicial"');
    }
  };

  const loadData = () => {
    if (!user) return;
    const allUsers = db.getUsers();
    const freshUser = allUsers.find(u => db.isSameUser(u.id, user.id)) || user;
    
    const allSchedules = db.getSchedules().filter(s => {
      return db.isSameUser(s.riderId, freshUser.id);
    });

    const allDeliveries = db.getDeliveries().filter(d => {
      return db.isSameUser(d.riderId, freshUser.id);
    });

    const allNotifications = db.getNotifications().filter(n => {
      return db.isSameUser(n.riderId, freshUser.id);
    });

    const allEsts = db.getEstablishments().filter(e => e.active);
    const myRoutes = db.getRouteHistory().filter(r => db.isSameUser(r.riderId, freshUser.id));
    
    const sortedSchedules = [...allSchedules].sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift) || a.id.localeCompare(b.id));
    const sortedDeliveries = [...allDeliveries].sort((a, b) => 
      b.date.localeCompare(a.date) || 
      b.time.localeCompare(a.time) || 
      b.id.localeCompare(a.id)
    );

    const sortedNotifications = [...allNotifications].sort((a, b) => b.date.localeCompare(a.date));

    setSchedules(sortedSchedules);
    setDeliveries(sortedDeliveries);
    setNotifications(sortedNotifications);
    setEstablishments(allEsts);
    setRouteHistory(myRoutes);

    if (!hasInitializedDestRef.current) {
      let restoredFromStorage = false;
      try {
        const navKey = `motoboy_active_nav_${freshUser.id}`;
        const savedNav = localStorage.getItem(navKey);
        if (savedNav) {
          const parsed = JSON.parse(savedNav);
          if (parsed.activeDestination) {
            setNavDestination(parsed.activeDestination);
            restoredFromStorage = true;
          }
          if (parsed.isNavigating) {
            setActiveTab('navigation');
          }
        }
      } catch (e) {}

      if (!restoredFromStorage) {
        const operationalTodayStr = db.getOperationalDateString();
        const todaySch = sortedSchedules.find(s => isSameDayString(s.date, operationalTodayStr));
        if (todaySch) {
          const est = db.resolveEstablishment(todaySch.establishmentId);
          if (est && est.address) {
            const addrText = `${est.address.street}, ${est.address.number} - ${est.address.neighborhood}, ${est.address.city}/${est.address.state}`;
            setNavDestination({
              name: est.name,
              addressText: addrText
            });
          }
        }
      }
      hasInitializedDestRef.current = true;
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'rider') {
      navigate('/login');
      return;
    }
    requestNotificationPermission();
    loadData();

    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadData());
    }, 2000);

    const handleSyncComplete = () => loadData();
    const handleHistoryUpdated = () => loadData();

    window.addEventListener('db-sync-complete', handleSyncComplete);
    window.addEventListener('route-history-updated', handleHistoryUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('db-sync-complete', handleSyncComplete);
      window.removeEventListener('route-history-updated', handleHistoryUpdated);
    };
  }, [user, navigate, activeTab]);

  const orderNumberCountMap = useMemo(() => {
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

  const handleLogout = async () => {
    if (user) {
      gpsTracker.stopTracking();
      await db.clearRiderLocation(user.id);
    }
    db.setCurrentUser(null);
    navigate('/login');
  };

  const handleShareTracking = (deliveryId: string) => {
    const origin = window.location.origin || `${window.location.protocol}//${window.location.host}`;
    const link = `${origin}/#/track/${deliveryId}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedId(deliveryId);
        setTimeout(() => setCopiedId(null), 2500);
      }).catch(() => {
        prompt('Copie o link de rastreio para o cliente:', link);
      });
    } else {
      prompt('Copie o link de rastreio para o cliente:', link);
    }
  };

  const handleNavigateToEst = (est: Establishment) => {
    const addrText = `${est.address.street}, ${est.address.number} - ${est.address.neighborhood}, ${est.address.city}/${est.address.state}`;
    setNavDestination({
      name: est.name,
      addressText: addrText
    });
    setActiveTab('navigation');
  };

  const handleReNavigateFromHistory = (item: RouteHistoryItem) => {
    setNavDestination({
      name: item.destinationName,
      addressText: item.destinationAddress,
      lat: item.destinationLat,
      lng: item.destinationLng
    });
    setActiveTab('navigation');
  };

  const operationalTodayStr = db.getOperationalDateString();

  // CORRIDAS DO DIA (compara tanto pela data do turno quanto pela data gravada)
  const todayDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      const opDate = getDeliveryOperationalDate(d.date, d.time);
      return isSameDayString(opDate, operationalTodayStr) || isSameDayString(d.date, operationalTodayStr);
    });
  }, [deliveries, operationalTodayStr]);

  const todayApprovedDeliveries = todayDeliveries.filter(d => d.status === 'active');
  const todayGrossEarnings = todayApprovedDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const todayNetEarnings = todayApprovedDeliveries.reduce((sum, d) => sum + getRiderNetForDelivery(d), 0);

  const getFutureSchedules = () => {
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const limitDateStr = db.getOperationalDateString(limit);

    return schedules.filter(s => {
      return s.date >= operationalTodayStr && s.date <= limitDateStr;
    }).sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift) || a.id.localeCompare(b.id));
  };

  const filteredFutureSchedules = getFutureSchedules().filter(s => {
    let matchesEst = true;
    if (scheduleEstFilter) {
      matchesEst = db.isSameEstablishment(s.establishmentId, scheduleEstFilter);
    }
    const matchesDate = scheduleDateFilter ? isSameDayString(s.date, scheduleDateFilter) : true;
    return matchesEst && matchesDate;
  });

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    const allNotif = db.getNotifications();
    const updatedAll = allNotif.map(n => n.id === id ? { ...n, read: true } : n);
    db.setNotifications(updatedAll);
  };

  const getScheduledEstablishmentsToday = (): Establishment[] => {
    const todaySchedules = schedules.filter(s => isSameDayString(s.date, operationalTodayStr));
    const resolvedEsts = todaySchedules
      .map(s => db.resolveEstablishment(s.establishmentId))
      .filter((e): e is Establishment => !!e);
    
    const uniqueEsts: Establishment[] = [];
    resolvedEsts.forEach(e => {
      if (!uniqueEsts.some(x => db.isSameEstablishment(x.id, e.id))) {
        uniqueEsts.push(e);
      }
    });

    return uniqueEsts;
  };

  const getRiderHistoryEstablishments = () => {
    const scheduledEstIds = new Set(schedules.map(s => s.establishmentId));
    const deliveryEstIds = new Set(deliveries.map(d => d.establishmentId));
    const allRelatedEstIds = new Set([...scheduledEstIds, ...deliveryEstIds]);

    return establishments.filter(e => 
      allRelatedEstIds.has(e.id) || 
      Array.from(allRelatedEstIds).some(id => db.isSameEstablishment(e.id, id))
    );
  };

  const availableDeliveriesForLinking = todayDeliveries.filter(d => 
    (!editingDelivery || d.id !== editingDelivery.id) && d.orderNumber
  );

  const handleLaunchDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmittingDelivery) return;

    const scheduledEsts = getScheduledEstablishmentsToday();
    if (scheduledEsts.length === 0) {
      alert('Acesso negado: Você não está escalado em nenhum estabelecimento para o dia de hoje.');
      return;
    }

    if (!scheduledEsts.some(e => db.isSameEstablishment(e.id, launchForm.establishmentId))) {
      alert('Erro: Você só pode lançar corridas para o estabelecimento em que está escalado hoje.');
      return;
    }

    const baseVal = parseFloat(launchForm.value.replace(',', '.'));
    const addVal = parseFloat((launchForm.additionalValue || '0').replace(',', '.')) || 0;
    const finalVal = baseVal + addVal;

    if (isNaN(finalVal) || finalVal <= 0) {
      alert('Erro: O valor da肌 corrida deve ser maior que zero.');
      return;
    }

    const cleanOrderNumber = launchForm.orderNumber.trim().replace('#', '');
    if (!cleanOrderNumber) {
      alert('Erro: O número do pedido é obrigatório.');
      return;
    }

    if (!/^\d{1,4}$/.test(cleanOrderNumber)) {
      alert('Erro: O número do pedido deve conter apenas números (máximo 4 dígitos).');
      return;
    }

    const collectionAmount = launchForm.orderCollectionAmount ? parseFloat(launchForm.orderCollectionAmount.replace(',', '.')) : undefined;
    const changeForValue = launchForm.changeFor ? parseFloat(launchForm.changeFor.replace(',', '.')) : undefined;

    if (!db.lockOrder(cleanOrderNumber, operationalTodayStr, new Date().toTimeString().slice(0, 5))) {
      alert('Aviso: Este pedido já está sendo gravado no momento.');
      return;
    }

    const dupCheck = db.checkDuplicateOrderNumber(cleanOrderNumber, operationalTodayStr, new Date().toTimeString().slice(0, 5), editingDelivery?.id);
    if (dupCheck.isDuplicate) {
      db.unlockOrder(cleanOrderNumber, operationalTodayStr, new Date().toTimeString().slice(0, 5));
      const scheduledEst = getScheduledEstablishmentsToday()[0]?.name || dupCheck.establishmentName || 'seu estabelecimento';
      alert(
        `⚠️ Atenção: Não é possível lançar o pedido #${cleanOrderNumber}.\n\n` +
        `Este número de pedido já consta lançado hoje por "${dupCheck.riderName}".\n\n` +
        `Caso seja uma entrega duplicada ou dividida, por favor solicite o lançamento ao Administrador ou ao Estabelecimento (${scheduledEst}) onde você está escalado / lotado.`
      );
      return;
    }

    setIsSubmittingDelivery(true);

    try {
      const allDeliveries = db.getDeliveries();
      const activeSchedule = schedules.find(s => db.isSameEstablishment(s.establishmentId, launchForm.establishmentId) && isSameDayString(s.date, operationalTodayStr));
      const nowStr = new Date().toISOString();

      const isSame = launchForm.deliveryType === 'same_address' || Number(finalVal) === 4 || Boolean(launchForm.linkedOrderNumber);

      if (editingDelivery) {
        const updated = allDeliveries.map(d => d.id === editingDelivery.id ? {
          ...d,
          establishmentId: launchForm.establishmentId,
          value: finalVal,
          orderNumber: cleanOrderNumber,
          notes: launchForm.notes.trim() || undefined,
          deliveryType: isSame ? ('same_address' as const) : ('standard' as const),
          additionalValue: addVal > 0 ? addVal : undefined,
          additionalReason: launchForm.additionalReason?.trim() || undefined,
          linkedOrderNumber: isSame ? (launchForm.linkedOrderNumber?.trim().replace('#', '') || undefined) : undefined,
          paymentMethod: launchForm.paymentMethod || 'already_paid',
          orderCollectionAmount: collectionAmount,
          changeFor: changeForValue,
          scheduleId: activeSchedule?.id || d.scheduleId,
          updatedAt: nowStr
        } : d);

        await db.setDeliveries(updated);
        alert('Corrida atualizada com sucesso!');
      } else {
        const newDelivery: Delivery = {
          id: 'd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          riderId: user.id,
          establishmentId: launchForm.establishmentId,
          date: operationalTodayStr,
          time: new Date().toTimeString().slice(0, 5),
          value: finalVal,
          status: 'pending',
          scheduleId: activeSchedule?.id,
          orderNumber: cleanOrderNumber,
          notes: launchForm.notes.trim() || undefined,
          deliveryType: isSame ? ('same_address' as const) : ('standard' as const),
          additionalValue: addVal > 0 ? addVal : undefined,
          additionalReason: launchForm.additionalReason?.trim() || undefined,
          linkedOrderNumber: isSame ? (launchForm.linkedOrderNumber?.trim().replace('#', '') || undefined) : undefined,
          paymentMethod: launchForm.paymentMethod || 'already_paid',
          orderCollectionAmount: collectionAmount,
          changeFor: changeForValue,
          updatedAt: nowStr
        };

        await db.setDeliveries([...allDeliveries, newDelivery]);
        alert(`🎉 Corrida #${cleanOrderNumber} lançada com sucesso! Aguardando aprovação.`);
      }

      setShowLaunchModal(false);
      setEditingDelivery(null);
      setLaunchForm({ establishmentId: '', value: '8.00', orderNumber: '', notes: '', deliveryType: 'standard', additionalValue: '', additionalReason: '', linkedOrderNumber: '', paymentMethod: 'already_paid', orderCollectionAmount: '', changeFor: '' });
      loadData();
    } catch (err) {
      console.error('Erro ao salvar corrida:', err);
      alert('Erro ao gravar corrida. Tente novamente.');
    } finally {
      setIsSubmittingDelivery(false);
      db.unlockOrder(cleanOrderNumber, operationalTodayStr, new Date().toTimeString().slice(0, 5));
    }
  };

  const handleSendCustomerMessage = (text: string) => {
    if (!customerChatDeliveryId) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const formattedMessage = `[${dateStr} ${timeStr} - Motoboy (${user?.name})]: ${text}`;
    const currentDelivery = deliveries.find(d => d.id === customerChatDeliveryId);
    if (!currentDelivery) return;

    const updatedChat = currentDelivery.customerChat ? `${currentDelivery.customerChat}\n${formattedMessage}` : formattedMessage;

    const allDeliveries = db.getDeliveries();
    const updated = allDeliveries.map(d => d.id === customerChatDeliveryId ? {
      ...d,
      customerChat: updatedChat,
      updatedAt: new Date().toISOString()
    } : d);

    db.setDeliveries(updated);
    loadData();
  };

  const handleSaveNotes = (deliveryId: string, updatedNotes: string) => {
    const allDeliveries = db.getDeliveries();
    const updated = allDeliveries.map(d => d.id === deliveryId ? {
      ...d,
      notes: updatedNotes,
      updatedAt: new Date().toISOString()
    } : d);
    db.setDeliveries(updated);
    loadData();
  };

  const handleSaveScheduleChat = (scheduleId: string, updatedChat: string) => {
    const allSchedules = db.getSchedules();
    const updated = allSchedules.map(s => s.id === scheduleId ? {
      ...s,
      chat: updatedChat,
      updatedAt: new Date().toISOString()
    } : s);
    db.setSchedules(updated);
    loadData();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getShiftLabel = (shift: string) => {
    switch(shift) {
      case 'morning': return 'Manhã';
      case 'afternoon': return 'Tarde';
      case 'night': return 'Noite';
      default: return shift;
    }
  };

  const scheduledEstsToday = getScheduledEstablishmentsToday();
  const todaySchedule = schedules.find(s => isSameDayString(s.date, operationalTodayStr));
  const riderHistoryEsts = getRiderHistoryEstablishments();

  // Filtragem de Corridas de Hoje com Status e Tipo
  const filteredTodayDeliveries = todayDeliveries.filter(d => {
    if (deliveryStatusFilter !== 'all' && d.status !== deliveryStatusFilter) return false;

    const isSame = d.deliveryType === 'same_address' || Number(d.value) === 4 || Boolean(d.linkedOrderNumber);

    if (deliveryFeatureFilter === 'same_order_number') {
      const repeats = getOrderRepeatCount(d);
      if (repeats <= 1) return false;
    } else if (deliveryFeatureFilter === 'with_additional') {
      const hasAdd = Number(d.additionalValue || 0) > 0;
      if (!hasAdd) return false;
    } else if (deliveryFeatureFilter === 'linked') {
      if (!isSame) return false;
    } else if (deliveryFeatureFilter === 'standard') {
      if (isSame || (d.additionalValue && Number(d.additionalValue) > 0)) return false;
    }

    return true;
  });

  // Filtragem de Histórico com Turno Inteligente + Tipo
  const historyDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      let matchesEst = true;
      if (historyEstFilter) {
        matchesEst = db.isSameEstablishment(d.establishmentId, historyEstFilter);
      }
      if (!matchesEst) return false;

      if (historyOrderNumberFilter.trim()) {
        const cleanNum = historyOrderNumberFilter.trim().toLowerCase().replace('#', '');
        const dNum = (d.orderNumber || '').toLowerCase().replace('#', '');
        if (!dNum.includes(cleanNum)) return false;
      }

      const isSame = d.deliveryType === 'same_address' || Number(d.value) === 4 || Boolean(d.linkedOrderNumber);

      if (deliveryFeatureFilter === 'same_order_number') {
        const repeats = getOrderRepeatCount(d);
        if (repeats <= 1) return false;
      } else if (deliveryFeatureFilter === 'with_additional') {
        const hasAdd = Number(d.additionalValue || 0) > 0;
        if (!hasAdd) return false;
      } else if (deliveryFeatureFilter === 'linked') {
        if (!isSame) return false;
      } else if (deliveryFeatureFilter === 'standard') {
        if (isSame || (d.additionalValue && Number(d.additionalValue) > 0)) return false;
      }

      if (filterMode === 'smart_shift') {
        if (!smartDate) return true;
        const opDate = getDeliveryOperationalDate(d.date, d.time);
        const isDateMatch = isSameDayString(opDate, smartDate) || isSameDayString(d.date, smartDate);
        if (!isDateMatch) return false;

        const [h] = (d.time || '12:00').split(':').map(Number);

        if (smartPeriod === 'night_shift') {
          return h >= 18 || h < 3;
        } else if (smartPeriod === 'morning_shift') {
          return h >= 6 && h < 12;
        } else if (smartPeriod === 'afternoon_shift') {
          return h >= 12 && h < 18;
        }
        return true;
      } else if (filterMode === 'date_range') {
        const matchesFrom = historyDateFrom ? d.date >= historyDateFrom : true;
        const matchesTo = historyDateTo ? d.date <= historyDateTo : true;
        return matchesFrom && matchesTo;
      }

      return true;
    });
  }, [deliveries, historyEstFilter, historyOrderNumberFilter, deliveryFeatureFilter, filterMode, smartDate, smartPeriod, historyDateFrom, historyDateTo]);

  const historyTotalEarnings = historyDeliveries
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + Number(d.value || 0), 0);

  // --- LÓGICA DO HISTÓRICO DE GANHOS ---
  const getEarningsDateBounds = (): { start: string; end: string; label: string } => {
    const now = new Date();
    if (earningsPeriodMode === 'today') {
      const todayStr = db.getOperationalDateString();
      return { start: todayStr, end: todayStr, label: 'Hoje (Turno Atual)' };
    }

    if (earningsPeriodMode === 'this_week') {
      const monStr = getThisMonday();
      const [y, m, d] = monStr.split('-').map(Number);
      const sun = new Date(y, m - 1, d + 6);
      const sunStr = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
      return { start: monStr, end: sunStr, label: 'Esta Semana' };
    }

    if (earningsPeriodMode === 'last_week') {
      const monStr = getThisMonday();
      const [y, m, d] = monStr.split('-').map(Number);
      const lastMon = new Date(y, m - 1, d - 7);
      const lastSun = new Date(y, m - 1, d - 1);
      const lastMonStr = `${lastMon.getFullYear()}-${String(lastMon.getMonth() + 1).padStart(2, '0')}-${String(lastSun.getDate()).padStart(2, '0')}`;
      const lastSunStr = `${lastSun.getFullYear()}-${String(lastSun.getMonth() + 1).padStart(2, '0')}-${String(lastSun.getDate()).padStart(2, '0')}`;
      return { start: lastMonStr, end: lastSunStr, label: 'Semana Passada' };
    }

    if (earningsPeriodMode === 'this_month') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start: startStr, end: endStr, label: 'Este Mês' };
    }

    return {
      start: earningsCustomFrom || '1970-01-01',
      end: earningsCustomTo || '2099-12-31',
      label: 'Período Personalizado'
    };
  };

  const earningsBounds = getEarningsDateBounds();

  const filteredEarningsDeliveries = deliveries.filter(d => {
    if (d.status !== 'active') return false;

    if (d.date < earningsBounds.start || d.date > earningsBounds.end) return false;

    if (earningsEstFilter && !db.isSameEstablishment(d.establishmentId, earningsEstFilter)) return false;

    if (earningsPaidFilter === 'unpaid' && d.paid) return false;
    if (earningsPaidFilter === 'paid' && !d.paid) return false;

    const isSame = d.deliveryType === 'same_address' || Number(d.value) === 4 || Boolean(d.linkedOrderNumber);

    if (earningsFeatureFilter === 'same_order_number') {
      const repeats = getOrderRepeatCount(d);
      if (repeats <= 1) return false;
    } else if (earningsFeatureFilter === 'with_additional') {
      const hasAdd = Number(d.additionalValue || 0) > 0;
      if (!hasAdd) return false;
    } else if (earningsFeatureFilter === 'linked') {
      if (!isSame) return false;
    } else if (earningsFeatureFilter === 'standard') {
      if (isSame || (d.additionalValue && Number(d.additionalValue) > 0)) return false;
    }

    return true;
  });

  const isAllEarningsPaid = filteredEarningsDeliveries.length > 0 && filteredEarningsDeliveries.every(d => d.paid);

  const filteredNeighborhoods = NEIGHBORHOOD_RATES.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(rateSearch.toLowerCase().trim());
    const matchesPrice = ratePriceFilter === 'all' || item.price === ratePriceFilter;
    return matchesSearch && matchesPrice;
  });

  const uniquePrices = Array.from(new Set(NEIGHBORHOOD_RATES.map(item => item.price))).sort((a, b) => a - b);

  const activeNotesDelivery = deliveries.find(d => d.id === notesDeliveryId) || null;
  const activeCustomerChatDelivery = deliveries.find(d => d.id === customerChatDeliveryId) || null;
  const activeScheduleChat = schedules.find(s => s.id === activeScheduleChatId) || null;

  const setSmartDateToToday = () => {
    setSmartDate(db.getOperationalDateString());
  };

  const setSmartDateToYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSmartDate(db.getOperationalDateString(d));
  };

  const isSameAddress = launchForm.deliveryType === 'same_address';
  const isPaymentOnDelivery = launchForm.paymentMethod !== 'already_paid';

  const renderPaymentBadge = (delivery: Delivery) => {
    const pm = delivery.paymentMethod || 'already_paid';
    if (pm === 'already_paid') return null;

    const amountStr = delivery.orderCollectionAmount ? `R$ ${Number(delivery.orderCollectionAmount).toFixed(2)}` : '';
    const changeStr = delivery.changeFor ? ` (Troco p/ R$ ${Number(delivery.changeFor).toFixed(2)})` : '';

    if (pm === 'money') {
      return (
        <div className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-emerald-400">
          <Banknote className="h-3.5 w-3.5 flex-shrink-0" />
          <span>COBRAR EM DINHEIRO: {amountStr}{changeStr}</span>
        </div>
      );
    }

    if (pm === 'card_debit') {
      return (
        <div className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-blue-400">
          <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
          <span>COBRAR NO DÉBITO: {amountStr} (LEVAR MAQUININHA)</span>
        </div>
      );
    }

    if (pm === 'card_credit') {
      return (
        <div className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-indigo-400">
          <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
          <span>COBRAR NO CRÉDITO: {amountStr} (LEVAR MAQUININHA)</span>
        </div>
      );
    }

    if (pm === 'pix_delivery') {
      return (
        <div className="bg-teal-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-teal-400">
          <QrCode className="h-3.5 w-3.5 flex-shrink-0" />
          <span>COBRAR NO PIX: {amountStr}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16 relative">
      <ChatToastBanner toast={activeToast} onClose={() => setActiveToast(null)} />

      <header className="bg-indigo-600 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-indigo-200">Olá, bem-vindo!</p>
            <h1 className="text-lg font-bold truncate max-w-[200px] sm:max-w-none">{user?.name}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleInstallPwa}
              className="bg-indigo-700 hover:bg-indigo-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors"
              title="Instalar App na Tela Inicial para GPS contínuo"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Instalar App</span>
            </button>
            <button
              onClick={() => {
                const scheduled = getScheduledEstablishmentsToday();
                if (scheduled.length === 0) {
                  alert('Acesso restrito: Você não possui nenhuma escala ativa para o dia de hoje.\n\nPara lançar corridas, solicite ao administrador ou ao gerente da sua loja a sua inclusão na escala.');
                  return;
                }
                setEditingDelivery(null);
                setLaunchForm({ establishmentId: scheduled[0].id, value: '8.00', orderNumber: '', notes: '', deliveryType: 'standard', additionalValue: '', additionalReason: '', linkedOrderNumber: '', paymentMethod: 'already_paid', orderCollectionAmount: '', changeFor: '' });
                setShowLaunchModal(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Lançar Corrida</span>
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-indigo-700 rounded-full transition-colors flex items-center space-x-1 text-sm"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-xl mb-6 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-emerald-900">Rastreamento Contínuo Ativo</h4>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              Sua localização continua sendo transmitida para a loja em tempo real.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 bg-white rounded-xl p-1 shadow-sm mb-6 border border-slate-200 gap-1 text-xs sticky top-[68px] z-20">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2.5 font-bold rounded-lg flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Início</span>
          </button>
          
          <button
            onClick={() => setActiveTab('navigation')}
            className={`py-2.5 font-bold rounded-lg flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'navigation' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Compass className="h-4 w-4 text-emerald-400" />
            <span>GPS App</span>
          </button>

          <button
            onClick={() => setActiveTab('schedules')}
            className={`py-2.5 font-bold rounded-lg flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'schedules' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Escalas</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 font-bold rounded-lg flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'history' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Histórico ({deliveries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('earnings')}
            className={`py-2.5 font-bold rounded-lg flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'earnings' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/70'
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span>Ganhos</span>
          </button>

          <button
            onClick={() => setActiveTab('rates')}
            className={`py-2.5 font-bold rounded-lg flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'rates' ? 'bg-amber-500 text-slate-950 shadow-sm font-black' : 'text-amber-800 bg-amber-50/50 hover:bg-amber-100/70'
            }`}
          >
            <Tag className="h-4 w-4" />
            <span>Tarifas</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2.5 font-bold rounded-lg flex items-center justify-center space-x-1 relative ${
              activeTab === 'notifications' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Avisos</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Faturado Hoje (Líquido)</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {todayNetEarnings.toFixed(2)}</p>
                  {todayGrossEarnings > todayNetEarnings && (
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                      Bruto: R$ {todayGrossEarnings.toFixed(2)} (taxa adm R$ 1 descontada apenas nas corridas padrão)
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Corridas de Hoje</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {todayDeliveries.length}
                  </p>
                </div>
              </div>
            </div>

            {todaySchedule ? (
              (() => {
                const est = resolveEst(todaySchedule.establishmentId);
                return (
                  <div className="bg-indigo-600 text-white p-5 rounded-2xl shadow-lg space-y-4 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                          Escala de Hoje
                        </span>
                        <h3 className="text-xl font-extrabold mt-2">{est?.name || 'Estabelecimento'}</h3>
                        <p className="text-xs text-indigo-100 flex items-center gap-1 mt-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Turno da {getShiftLabel(todaySchedule.shift)} ({todaySchedule.startTime} - {todaySchedule.endTime})</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveScheduleChatId(todaySchedule.id)}
                        className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                        title="Chat do Turno"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Chat</span>
                      </button>
                    </div>

                    {est?.address && (
                      <div className="bg-white/10 p-3.5 rounded-xl flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-5 w-5 text-indigo-200 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-indigo-50">
                            <p className="font-bold">{est.address.street}, {est.address.number}</p>
                            <p>{est.address.neighborhood} • {est.address.city}/{est.address.state}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleNavigateToEst(est)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all w-full sm:w-auto"
                        >
                          <Compass className="h-4 w-4" />
                          <span>Navegar para o Estabelecimento</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Sem Escala para Hoje</p>
                  <p className="text-xs text-amber-700 mt-0.5">Você não está escalado em nenhum estabelecimento hoje. Para lançar corridas, solicite sua escala ao gerente ou administrador.</p>
                </div>
              </div>
            )}

            {/* SEÇÃO: CORRIDAS DE HOJE */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-indigo-600" />
                  <span>Corridas de Hoje ({todayDeliveries.length})</span>
                </h3>
                
                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  <select
                    value={deliveryFeatureFilter}
                    onChange={(e) => setDeliveryFeatureFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 border border-purple-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 bg-purple-50/70 font-bold text-purple-900"
                  >
                    <option value="all">Todos os Tipos</option>
                    <option value="same_order_number">👯‍♂️ Pedidos com Mesmo Nº (Repetidos)</option>
                    <option value="with_additional">✨ Com Adicional</option>
                    <option value="linked">🔗 Vinculadas (Mesmo Local)</option>
                    <option value="standard">Padrão</option>
                  </select>

                  <select
                    value={deliveryStatusFilter}
                    onChange={(e) => setDeliveryStatusFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 font-semibold text-slate-700"
                  >
                    <option value="all">Todas ({todayDeliveries.length})</option>
                    <option value="active">Aprovadas ({todayDeliveries.filter(d => d.status === 'active').length})</option>
                    <option value="pending">Pendentes ({todayDeliveries.filter(d => d.status === 'pending').length})</option>
                    <option value="rejected">Rejeitadas ({todayDeliveries.filter(d => d.status === 'rejected').length})</option>
                    <option value="cancelled">Canceladas ({todayDeliveries.filter(d => d.status === 'cancelled').length})</option>
                  </select>
                </div>
              </div>

              {filteredTodayDeliveries.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p>Nenhuma corrida lançada hoje com este filtro.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredTodayDeliveries.map((delivery) => {
                    const est = resolveEst(delivery.establishmentId);
                    const hasNotes = Boolean(delivery.notes && delivery.notes.trim());
                    const notesCount = delivery.notes ? delivery.notes.split('\n').filter(l => l.trim()).length : 0;
                    const isSame = delivery.deliveryType === 'same_address' || Number(delivery.value) === 4 || Boolean(delivery.linkedOrderNumber);
                    const hasAdditional = Number(delivery.additionalValue || 0) > 0;
                    const repeatCount = getOrderRepeatCount(delivery);

                    return (
                      <div key={delivery.id} className={`py-3.5 space-y-2 ${repeatCount > 1 ? 'bg-amber-50/30 p-3 rounded-xl border border-amber-200' : ''} ${isSame ? 'bg-purple-50/40 p-3 rounded-xl border border-purple-100' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {delivery.orderNumber && (
                                <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex-shrink-0 tracking-wide">
                                  #{delivery.orderNumber}
                                </span>
                              )}
                              <p className="font-bold text-slate-800 text-sm">{est?.name || 'Estabelecimento'}</p>

                              {repeatCount > 1 && (
                                <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs border border-amber-600 animate-pulse">
                                  <Copy className="h-2.5 w-2.5" />
                                  <span>Nº Repetido ({repeatCount}x)</span>
                                </span>
                              )}

                              {isSame && (
                                <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                  <Link2 className="h-3 w-3" />
                                  <span>Mesmo Endereço {delivery.linkedOrderNumber ? `(Pedido #${delivery.linkedOrderNumber})` : ''}</span>
                                </span>
                              )}

                              {hasAdditional && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Sparkles className="h-3 w-3 text-amber-600" />
                                  <span>
                                    + R$ {Number(delivery.additionalValue).toFixed(2)}
                                    {delivery.additionalReason ? ` (${delivery.additionalReason})` : ' Extra'}
                                  </span>
                                </span>
                              )}

                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                delivery.status === 'active' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : delivery.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : delivery.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}>
                                {delivery.status === 'active' && 'Aprovada'}
                                {delivery.status === 'pending' && 'Pendente'}
                                {delivery.status === 'rejected' && 'Rejeitada'}
                                {delivery.status === 'cancelled' && 'Cancelada'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 flex items-center space-x-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>Horário: {delivery.time}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            <button
                              onClick={() => setNotesDeliveryId(delivery.id)}
                              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-extrabold ${
                                hasNotes 
                                  ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 border border-amber-500 shadow-md ring-2 ring-amber-300' 
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                              }`}
                              title="Observações da Corrida"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Observações</span>
                              {hasNotes && (
                                <span className="bg-amber-950 text-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                                  {notesCount}
                                </span>
                              )}
                            </button>

                            {(delivery.status === 'active' || delivery.status === 'pending') && (
                              <button
                                onClick={() => setCustomerChatDeliveryId(delivery.id)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                title="Chat com Cliente"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span>Chat Cliente</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleShareTracking(delivery.id)}
                              className={`px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                                copiedId === delivery.id 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                              }`}
                              title="Compartilhar Link de Rastreamento"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <span>{copiedId === delivery.id ? 'Copiado!' : 'Rastreio'}</span>
                            </button>

                            <span className={`font-black text-sm ml-auto sm:ml-0 ${delivery.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                              R$ {Number(delivery.value || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {renderPaymentBadge(delivery)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={activeTab === 'navigation' ? 'space-y-4' : 'hidden'}>
          <RiderNavigationMap
            currentLocation={activePos}
            destination={navDestination}
            defaultFullscreen={false}
          />
        </div>

        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <span>Minhas Escalas de Trabalho (Próximos 30 dias)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Estabelecimento</label>
                  <select
                    value={scheduleEstFilter}
                    onChange={(e) => setScheduleEstFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">Todos os Estabelecimentos</option>
                    {riderHistoryEsts.map(est => (
                      <option key={est.id} value={est.id}>{est.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Data</label>
                  <input
                    type="date"
                    value={scheduleDateFilter}
                    onChange={(e) => setScheduleDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {filteredFutureSchedules.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">Nenhuma escala futura encontrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFutureSchedules.map((sch) => {
                    const est = resolveEst(sch.establishmentId);
                    const isToday = sch.date === operationalTodayStr;

                    return (
                      <div 
                        key={sch.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isToday 
                            ? 'bg-emerald-50 border-emerald-300 shadow-sm' 
                            : 'bg-white border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isToday && (
                                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                  Hoje
                                </span>
                              )}
                              <h4 className="text-base font-bold text-slate-800">{est?.name || 'Estabelecimento'}</h4>
                            </div>

                            <p className="text-xs text-slate-600 flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-indigo-600">Turno da {getShiftLabel(sch.shift)}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-slate-500">{sch.startTime}–{sch.endTime}</span>
                            </p>

                            {est?.address && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <span>{est.address.street}, {est.address.number} - {est.address.neighborhood}, {est.address.city}/{est.address.state}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                            {est && (
                              <button
                                onClick={() => handleNavigateToEst(est)}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shadow-sm"
                                title="Abrir no Mapa Integrado do MotoHub"
                              >
                                <Compass className="h-4 w-4" />
                                <span>Navegar GPS</span>
                              </button>
                            )}
                            <button
                              onClick={() => setActiveScheduleChatId(sch.id)}
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                              title="Chat do Turno"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span className="hidden sm:inline">Chat</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: HISTÓRICO DE CORRIDAS & ROTAS GPS */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-600" />
                  <span>Histórico de Corridas ({deliveries.length})</span>
                </h2>

                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setHistorySubTab('deliveries')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                        historySubTab === 'deliveries' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Corridas ({historyDeliveries.length})
                    </button>
                    <button
                      onClick={() => setHistorySubTab('routes')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 ${
                        historySubTab === 'routes' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span>Rotas GPS ({routeHistory.length})</span>
                    </button>
                  </div>
                </div>
              </div>

              {historySubTab === 'deliveries' ? (
                <>
                  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                      <p className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5 tracking-wider">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        <span>FILTRO DE TURNO E PERÍODO</span>
                      </p>

                      <div className="flex items-center space-x-2">
                        <select
                          value={filterMode}
                          onChange={(e) => setFilterMode(e.target.value as any)}
                          className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-900 rounded-xl text-xs font-extrabold shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="smart_shift">✨ Turno Inteligente por Data</option>
                          <option value="date_range">📅 Intervalo de Datas</option>
                          <option value="all">🌐 Todas as Corridas</option>
                        </select>
                      </div>
                    </div>

                    {filterMode === 'smart_shift' && (
                      <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-indigo-950 uppercase">
                            Selecione o Turno:
                          </label>
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={setSmartDateToToday}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                            >
                              Hoje
                            </button>
                            <button
                              type="button"
                              onClick={setSmartDateToYesterday}
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
                              value={smartDate}
                              onChange={(e) => setSmartDate(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">PERÍODO / EXPEDIENTE</label>
                            <select
                              value={smartPeriod}
                              onChange={(e) => setSmartPeriod(e.target.value as any)}
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

                    {filterMode === 'date_range' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">De (Data Inicial)</label>
                          <input
                            type="date"
                            value={historyDateFrom}
                            onChange={(e) => setHistoryDateFrom(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Até (Data Final)</label>
                          <input
                            type="date"
                            value={historyDateTo}
                            onChange={(e) => setHistoryDateTo(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-slate-200">
                      <div>
                        <label className="block text-[10px] font-bold text-purple-700 uppercase mb-1 flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          <span>Tipo / Adicional</span>
                        </label>
                        <select
                          value={deliveryFeatureFilter}
                          onChange={(e) => setDeliveryFeatureFilter(e.target.value as any)}
                          className="w-full px-3 py-2 border border-purple-300 bg-purple-50/50 rounded-xl text-xs font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="all">Todos os Tipos</option>
                          <option value="same_order_number">👯‍♂️ Pedidos com Mesmo Nº (Repetidos)</option>
                          <option value="with_additional">✨ Com Adicional</option>
                          <option value="linked">🔗 Vinculadas (Mesmo Endereço)</option>
                          <option value="standard">Padrão</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1 flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          <span>Nº do Pedido</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Ex: 1042"
                            value={historyOrderNumberFilter}
                            onChange={(e) => setHistoryOrderNumberFilter(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 border border-indigo-200 bg-indigo-50/50 rounded-xl text-xs font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <Hash className="h-3.5 w-3.5 text-indigo-400 absolute left-2.5 top-2.5" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Estabelecimento
                        </label>
                        <select
                          value={historyEstFilter}
                          onChange={(e) => setHistoryEstFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Todos os Estabelecimentos</option>
                          {riderHistoryEsts.map(est => (
                            <option key={est.id} value={est.id}>{est.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                    <div>
                      <p className="text-xs text-indigo-600 font-bold uppercase">Corridas Filtradas</p>
                      <p className="text-xl font-extrabold text-slate-800 mt-0.5">{historyDeliveries.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-bold uppercase">Faturamento Total</p>
                      <p className="text-xl font-extrabold text-emerald-700 mt-0.5">R$ {historyTotalEarnings.toFixed(2)}</p>
                    </div>
                  </div>

                  {historyDeliveries.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <p className="text-sm font-medium">Nenhum registro encontrado para este filtro.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="divide-y divide-slate-100">
                        {historyDeliveries.slice(0, historyDisplayLimit).map((del) => {
                          const est = resolveEst(del.establishmentId);
                          const hasNotes = Boolean(del.notes && del.notes.trim());
                          const notesCount = del.notes ? del.notes.split('\n').filter(l => l.trim()).length : 0;
                          const isSame = del.deliveryType === 'same_address' || Number(del.value) === 4 || Boolean(del.linkedOrderNumber);
                          const hasAdditional = Number(del.additionalValue || 0) > 0;
                          const repeatCount = getOrderRepeatCount(del);

                          return (
                            <div key={del.id} className={`py-3.5 space-y-2 ${repeatCount > 1 ? 'bg-amber-50/30 p-3 rounded-xl border border-amber-200' : ''} ${isSame ? 'bg-purple-50/30 p-3 rounded-xl' : ''}`}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-lg">
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {del.orderNumber && (
                                      <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex-shrink-0 tracking-wide">
                                        #{del.orderNumber}
                                      </span>
                                    )}
                                    <p className="font-bold text-slate-800 text-sm">{est?.name || 'Estabelecimento'}</p>

                                    {repeatCount > 1 && (
                                      <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs border border-amber-600 animate-pulse">
                                        <Copy className="h-2.5 w-2.5" />
                                        <span>Nº Repetido ({repeatCount}x)</span>
                                      </span>
                                    )}

                                    {isSame && (
                                      <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                        <Link2 className="h-3 w-3" />
                                        <span>Mesmo Endereço {del.linkedOrderNumber ? `(#${del.linkedOrderNumber})` : ''}</span>
                                      </span>
                                    )}

                                    {hasAdditional && (
                                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Sparkles className="h-3 w-3 text-amber-600" />
                                        <span>
                                          + R$ {Number(del.additionalValue).toFixed(2)}
                                          {del.additionalReason ? ` (${del.additionalReason})` : ' Extra'}
                                        </span>
                                      </span>
                                    )}

                                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                      del.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {del.status === 'active' ? 'Aprovada' : del.status === 'pending' ? 'Pendente' : 'Cancelada'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400">
                                    Data: <strong className="text-slate-600">{new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong> às {del.time}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 justify-between sm:justify-end flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                  <button
                                    onClick={() => setNotesDeliveryId(del.id)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                                      hasNotes 
                                        ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 border border-amber-500 shadow-md ring-2 ring-amber-300' 
                                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                                    }`}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>Observações</span>
                                    {hasNotes && (
                                      <span className="bg-amber-950 text-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                                        {notesCount}
                                      </span>
                                    )}
                                  </button>
                                  
                                  <button
                                    onClick={() => handleShareTracking(del.id)}
                                    className={`px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                                      copiedId === del.id 
                                        ? 'bg-emerald-100 text-emerald-800' 
                                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                                    }`}
                                    title="Copiar Link de Rastreamento"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                    <span>{copiedId === del.id ? 'Copiado!' : 'Rastreio'}</span>
                                  </button>

                                  <span className={`font-black text-sm ${del.status === 'active' ? 'text-emerald-600' : 'text-slate-400 line-through'}`}>
                                    R$ {Number(del.value || 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              {renderPaymentBadge(del)}
                            </div>
                          );
                        })}
                      </div>

                      {historyDeliveries.length > historyDisplayLimit && (
                        <div className="pt-3 text-center">
                          <button
                            onClick={() => setHistoryDisplayLimit(prev => prev + PAGE_SIZE)}
                            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-colors inline-flex items-center gap-1.5"
                          >
                            <ChevronDown className="h-4 w-4" />
                            <span>Carregar mais ({historyDeliveries.length - historyDisplayLimit} restantes)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  {routeHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Compass className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-medium">Nenhuma rota gravada no histórico até o momento.</p>
                    </div>
                  ) : (
                    routeHistory.map((item) => (
                      <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 transition-all">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                            <h4 className="font-extrabold text-slate-800 text-sm truncate">{item.destinationName}</h4>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{item.destinationAddress}</p>
                          <div className="flex items-center gap-2 text-xs text-indigo-700 font-semibold pt-1">
                            <span>{item.date} às {item.time}</span>
                            <span>•</span>
                            <span>{(item.distanceMeters / 1000).toFixed(1)} km</span>
                            <span>•</span>
                            <span>{Math.ceil(item.durationSeconds / 60)} min de trajeto</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleReNavigateFromHistory(item)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                          <span>Navegar Novamente</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: HISTÓRICO DE GANHOS DO MOTOBOY COM AS 5 MÉTRICAS */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Wallet className="h-6 w-6 text-emerald-600" />
                    <span>Histórico de Ganhos & Repasses</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Acompanhe seu faturamento com discriminação das 5 métricas financeiras
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={earningsFeatureFilter}
                    onChange={(e) => setEarningsFeatureFilter(e.target.value as any)}
                    className="px-3 py-1.5 border border-purple-300 rounded-xl text-xs font-bold text-purple-900 bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="all">Todos os Tipos</option>
                    <option value="same_order_number">👯‍♂️ Pedidos com Mesmo Nº (Repetidos)</option>
                    <option value="with_additional">✨ Com Adicional</option>
                    <option value="linked">🔗 Vinculadas</option>
                    <option value="standard">Padrão</option>
                  </select>

                  <select
                    value={earningsPaidFilter}
                    onChange={(e) => setEarningsPaidFilter(e.target.value as any)}
                    className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">Todas as Corridas</option>
                    <option value="unpaid">A Repassar (Pendentes)</option>
                    <option value="paid">Já Pagas (Baixadas)</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <span className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5 tracking-wider">
                    <Filter className="h-4 w-4 text-emerald-600" />
                    <span>Período Selecionado: {earningsBounds.label}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setEarningsPeriodMode('this_week')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      earningsPeriodMode === 'this_week' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    📅 Esta Semana
                  </button>

                  <button
                    type="button"
                    onClick={() => setEarningsPeriodMode('last_week')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      earningsPeriodMode === 'last_week' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⏮️ Semana Passada
                  </button>

                  <button
                    type="button"
                    onClick={() => setEarningsPeriodMode('today')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      earningsPeriodMode === 'today' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⚡ Hoje (Turno)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEarningsPeriodMode('this_month')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      earningsPeriodMode === 'this_month' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    📆 Este Mês
                  </button>

                  <button
                    type="button"
                    onClick={() => setEarningsPeriodMode('custom')}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      earningsPeriodMode === 'custom' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🔍 Personalizado
                  </button>
                </div>

                {earningsPeriodMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Inicial</label>
                      <input
                        type="date"
                        value={earningsCustomFrom}
                        onChange={(e) => setEarningsCustomFrom(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Final</label>
                      <input
                        type="date"
                        value={earningsCustomTo}
                        onChange={(e) => setEarningsCustomTo(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200/60">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Filtrar por Estabelecimento
                  </label>
                  <select
                    value={earningsEstFilter}
                    onChange={(e) => setEarningsEstFilter(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="">Todos os Meus Estabelecimentos</option>
                    {riderHistoryEsts.map(est => (
                      <option key={est.id} value={est.id}>{est.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <RiderFinancialMetricsCard
                riderName={user?.name || 'Motoboy'}
                riderPhone={user?.phone}
                deliveries={filteredEarningsDeliveries}
                isPaid={isAllEarningsPaid}
                showSettleButton={false}
                periodLabel={earningsBounds.label}
              />

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Receipt className="h-4 w-4 text-emerald-600" />
                    <span>Detalhamento das Corridas do Período ({filteredEarningsDeliveries.length})</span>
                  </h4>
                </div>

                {filteredEarningsDeliveries.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-400">
                    Nenhuma corrida aprovada neste período.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    {filteredEarningsDeliveries.map(del => {
                      const est = resolveEst(del.establishmentId);
                      const isSame = del.deliveryType === 'same_address' || Number(del.value) === 4 || Boolean(del.linkedOrderNumber);
                      const hasAdd = Number(del.additionalValue || 0) > 0;
                      const riderNetVal = getRiderNetForDelivery(del);
                      const repeatCount = getOrderRepeatCount(del);

                      return (
                        <div key={del.id} className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors ${repeatCount > 1 ? 'border-l-4 border-l-amber-500 bg-amber-50/20' : ''}`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {del.orderNumber && (
                                <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                                  #{del.orderNumber}
                                </span>
                              )}
                              <p className="font-extrabold text-slate-800 text-xs">{est?.name || 'Estabelecimento'}</p>

                              {repeatCount > 1 && (
                                <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs border border-amber-600 animate-pulse">
                                  <Copy className="h-2.5 w-2.5" />
                                  <span>Nº Repetido ({repeatCount}x)</span>
                                </span>
                              )}

                              {isSame && (
                                <span className="bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                  <Link2 className="h-3 w-3" />
                                  <span>Mesmo Endereço {del.linkedOrderNumber ? `(#${del.linkedOrderNumber})` : '(R$ 4)'}</span>
                                </span>
                              )}

                              {hasAdd && (
                                <span className="bg-amber-100 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                  + R$ {Number(del.additionalValue).toFixed(2)} {del.additionalReason ? `(${del.additionalReason})` : ''}
                                </span>
                              )}

                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                del.paid ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'
                              }`}>
                                {del.paid ? 'Pago' : 'A Repassar'}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400">
                              {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 justify-between sm:justify-end">
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-bold">Bruto: R$ {Number(del.value).toFixed(2)}</p>
                              <p className="text-xs font-black text-emerald-600">Líquido: R$ {riderNetVal.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Tag className="h-6 w-6 text-amber-500" />
                    <span>Tabela Informativa de Tarifas por Bairro</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consulte os valores padrão das corridas de acordo com a localidade da entrega
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-extrabold w-fit">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span>{filteredNeighborhoods.length} bairros listados</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Digite o nome do bairro para consultar o valor (Ex: Bodocongó, Cuités, Catolé)..."
                    value={rateSearch}
                    onChange={(e) => setRateSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-xs"
                  />
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  {rateSearch && (
                    <button
                      onClick={() => setRateSearch('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] font-black uppercase text-slate-500 mr-1">Faixa de Preço:</span>
                  <button
                    onClick={() => setRatePriceFilter('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                      ratePriceFilter === 'all'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-black'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Todos
                  </button>
                  {uniquePrices.map(price => (
                    <button
                      key={price}
                      onClick={() => setRatePriceFilter(price)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                        ratePriceFilter === price
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-black'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      R$ {price.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>

              {filteredNeighborhoods.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 space-y-2">
                  <Tag className="h-10 w-10 mx-auto text-slate-300" />
                  <p className="text-sm font-medium">Nenhum bairro encontrado com o termo "{rateSearch}".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredNeighborhoods.map((item, idx) => {
                    const isHigh = item.price >= 12;
                    const isMedium = item.price === 10;
                    const isStandard = item.price === 8;

                    return (
                      <div 
                        key={idx}
                        className="bg-white border border-slate-200/90 hover:border-amber-400 p-3.5 rounded-2xl flex items-center justify-between shadow-xs transition-all hover:scale-[1.01]"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          <div className={`p-2 rounded-xl flex-shrink-0 ${
                            isHigh ? 'bg-purple-100 text-purple-700' :
                            isMedium ? 'bg-blue-100 text-blue-700' :
                            isStandard ? 'bg-indigo-100 text-indigo-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            <MapPin className="h-4 w-4" />
                          </div>
                          <span className="font-extrabold text-slate-800 text-xs sm:text-sm truncate">
                            {item.name}
                          </span>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl shadow-xs border ${
                            isHigh ? 'bg-purple-50 text-purple-800 border-purple-200' :
                            isMedium ? 'bg-blue-50 text-blue-800 border-blue-200' :
                            isStandard ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                            'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            R$ {item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-amber-50/60 border border-amber-200/70 p-3.5 rounded-2xl text-[11px] text-amber-900 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span>
                  Esta tabela de bairros serve como base de referência padrão para cobrança e lançamento das corridas.
                </span>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-indigo-600" />
                  <span>Central de Avisos e Notificações</span>
                </h2>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    {unreadCount} não lida(s)
                  </span>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">Nenhum aviso recebido até o momento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={`p-4 rounded-xl border transition-all ${
                        !notif.read ? 'bg-indigo-50/70 border-indigo-200 shadow-sm' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-800">{notif.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(notif.date).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        {!notif.read && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 flex-shrink-0"
                            title="Marcar como lida"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Lida</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {showLaunchModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-600" />
                <span>{editingDelivery ? 'Editar Corrida' : 'Lançar Nova Corrida'}</span>
              </h3>
              <button 
                onClick={() => { setShowLaunchModal(false); setEditingDelivery(null); }} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleLaunchDelivery} className="space-y-3.5">
              
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Tipo de Corrida
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLaunchForm({ ...launchForm, deliveryType: 'standard', value: '8.00' })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center transition-all ${
                      !isSameAddress
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Padrão</span>
                    <span className="text-[10px] font-bold mt-0.5 opacity-90">R$ 8,00</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLaunchForm({ ...launchForm, deliveryType: 'same_address', value: '4.00' })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center transition-all ${
                      isSameAddress
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Link2 className="h-3.5 w-3.5" />
                      <span>Mesmo Endereço</span>
                    </div>
                    <span className="text-[10px] font-bold mt-0.5 opacity-90">R$ 4,00</span>
                  </button>
                </div>
              </div>

              {isSameAddress && (
                <div className="bg-purple-50/80 border border-purple-200 p-3 rounded-xl space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs text-purple-900 font-extrabold">
                    <span className="flex items-center gap-1">
                      <Link2 className="h-3.5 w-3.5 text-purple-700" />
                      <span>Vincular ao Pedido Principal:</span>
                    </span>
                    <span className="text-[9px] uppercase tracking-wider bg-purple-200/80 text-purple-900 px-1.5 py-0.5 rounded-full font-bold">
                      Mesmo Local
                    </span>
                  </div>

                  {availableDeliveriesForLinking.length > 0 ? (
                    <div>
                      <select
                        value={launchForm.linkedOrderNumber || ''}
                        onChange={(e) => setLaunchForm({ ...launchForm, linkedOrderNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-xs bg-white font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="">Selecione o pedido do mesmo endereço...</option>
                        {availableDeliveriesForLinking.map(d => (
                          <option key={d.id} value={d.orderNumber}>
                            Pedido #{d.orderNumber} ({d.time} - R$ {Number(d.value).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Digite o Nº do Pedido Principal (Ex: 1042)"
                        value={launchForm.linkedOrderNumber || ''}
                        onChange={(e) => setLaunchForm({ ...launchForm, linkedOrderNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-xs bg-white font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-purple-700 font-medium">
                    Esta entrega é compartilhada no mesmo prédio/rua de outro pedido já despachado.
                  </p>
                </div>
              )}

              <div className="bg-amber-50/60 border border-amber-300/80 p-3 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                    <Banknote className="h-4 w-4 text-amber-600" />
                    <span>Pagamento do Pedido pelo Cliente</span>
                  </label>
                  {isPaymentOnDelivery && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-500 text-slate-950 rounded-full animate-pulse">
                      Cobrar Cliente
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setLaunchForm({ ...launchForm, paymentMethod: 'already_paid', orderCollectionAmount: '', changeFor: '' })}
                    className={`p-2 rounded-xl border font-bold flex flex-col items-center justify-center transition-all ${
                      launchForm.paymentMethod === 'already_paid'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 mb-0.5 text-emerald-400" />
                    <span className="text-[10px]">Já Pago</span>
                    <span className="text-[8px] opacity-70">(Online)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLaunchForm({ ...launchForm, paymentMethod: 'money' })}
                    className={`p-2 rounded-xl border font-bold flex flex-col items-center justify-center transition-all ${
                      launchForm.paymentMethod === 'money'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="h-4 w-4 mb-0.5" />
                    <span className="text-[10px]">Dinheiro</span>
                    <span className="text-[8px] opacity-80">(Troco)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLaunchForm({ ...launchForm, paymentMethod: 'card_debit', changeFor: '' })}
                    className={`p-2 rounded-xl border font-bold flex flex-col items-center justify-center transition-all ${
                      launchForm.paymentMethod === 'card_debit'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 mb-0.5" />
                    <span className="text-[10px]">Débito</span>
                    <span className="text-[8px] opacity-80">(Máquina)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLaunchForm({ ...launchForm, paymentMethod: 'card_credit', changeFor: '' })}
                    className={`p-2 rounded-xl border font-bold flex flex-col items-center justify-center transition-all ${
                      launchForm.paymentMethod === 'card_credit'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 mb-0.5" />
                    <span className="text-[10px]">Crédito</span>
                    <span className="text-[8px] opacity-80">(Máquina)</span>
                  </button>
                </div>

                {isPaymentOnDelivery && (
                  <div className="space-y-2 pt-2 border-t border-amber-200/60 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-amber-950 uppercase mb-1">
                          Valor a Cobrar do Cliente (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 45.90"
                          value={launchForm.orderCollectionAmount || ''}
                          onChange={(e) => setLaunchForm({ ...launchForm, orderCollectionAmount: e.target.value })}
                          className="w-full px-3 py-1.5 border border-amber-300 rounded-xl text-xs font-black text-amber-950 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      {launchForm.paymentMethod === 'money' && (
                        <div>
                          <label className="block text-[10px] font-black text-emerald-950 uppercase mb-1">
                            Troco para quanto? (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 50.00"
                            value={launchForm.changeFor || ''}
                            onChange={(e) => setLaunchForm({ ...launchForm, changeFor: e.target.value })}
                            className="w-full px-3 py-1.5 border border-emerald-300 rounded-xl text-xs font-black text-emerald-950 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Estabelecimento Escalado
                </label>
                <select
                  required
                  value={launchForm.establishmentId}
                  onChange={(e) => setLaunchForm({ ...launchForm, establishmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                >
                  {scheduledEstsToday.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Nº do Pedido (Obrigatório)</span>
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    Máx. 4 números
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]{1,4}"
                    placeholder="Ex: 1042"
                    value={launchForm.orderNumber}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setLaunchForm({ ...launchForm, orderNumber: digitsOnly });
                    }}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <Hash className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                      Taxa do Motoboy (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={launchForm.value}
                      onChange={(e) => setLaunchForm({ ...launchForm, value: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-amber-800 uppercase mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span>+ Adicional (R$)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.00"
                      placeholder="0.00"
                      value={launchForm.additionalValue || ''}
                      onChange={(e) => setLaunchForm({ ...launchForm, additionalValue: e.target.value })}
                      className="w-full px-3 py-2 border border-amber-300 rounded-xl text-sm font-bold text-amber-900 bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-amber-800 uppercase mb-1 flex items-center gap-1">
                    <HelpCircle className="h-3 w-3 text-amber-600" />
                    <span>Justificativa do Adicional (Motivo)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Distância / Bairro dos Cuités, Chuva, Taxa extra..."
                    value={launchForm.additionalReason || ''}
                    onChange={(e) => setLaunchForm({ ...launchForm, additionalReason: e.target.value })}
                    className="w-full px-2 py-1 border border-amber-300/80 rounded-xl text-xs font-semibold text-amber-950 bg-amber-50/40 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-amber-900/40"
                  />
                </div>

                <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">Total da Corrida:</span>
                  <span className="text-base font-black text-emerald-600">
                    R$ {((parseFloat(launchForm.value || '0') || 0) + (parseFloat(launchForm.additionalValue || '0') || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Observações Gerais (Opcional)
                </label>
                <textarea
                  placeholder="Ex: Troco para 50, bloco B apto 201..."
                  value={launchForm.notes}
                  onChange={(e) => setLaunchForm({ ...launchForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingDelivery}
                  onClick={() => { setShowLaunchModal(false); setEditingDelivery(null); }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingDelivery}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-1.5"
                >
                  {isSubmittingDelivery ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Gravando...</span>
                    </>
                  ) : (
                    <span>{editingDelivery ? 'Salvar Alterações' : 'Lançar Corrida'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeliveryNotesModal
        isOpen={!!notesDeliveryId}
        onClose={() => setNotesDeliveryId(null)}
        delivery={activeNotesDelivery}
        userRole="rider"
        userName={user?.name || 'Motoboy'}
        onSaveNotes={handleSaveNotes}
      />

      <CustomerChatModal
        isOpen={!!customerChatDeliveryId}
        onClose={() => setCustomerChatDeliveryId(null)}
        delivery={activeCustomerChatDelivery}
        onSendMessage={handleSendCustomerMessage}
        viewerRole="rider"
      />

      <ScheduleChatModal
        isOpen={!!activeScheduleChatId}
        onClose={() => setActiveScheduleChatId(null)}
        schedule={activeScheduleChat}
        userRole="rider"
        userName={user?.name || 'Motoboy'}
        onSaveChat={handleSaveScheduleChat}
      />
    </div>
  );
}