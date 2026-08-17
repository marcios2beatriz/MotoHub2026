"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Schedule, Delivery, Notification, Establishment, RouteHistoryItem, getDeliveryOperationalDate, isSameDayString } from '../utils/db';
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
  Hash
} from 'lucide-react';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import CustomerChatModal from '../components/CustomerChatModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import RiderNavigationMap from '../components/RiderNavigationMap';
import ChatToastBanner, { ChatToast } from '../components/ChatToastBanner';
import { sendDeviceNotification, playNotificationSound, requestNotificationPermission } from '../utils/notifications';
import { gpsTracker, GpsState } from '../utils/gpsTracker';

export default function RiderDashboard() {
  const navigate = useNavigate();
  const [user] = useState(db.getCurrentUser());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryItem[]>([]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedules' | 'history' | 'notifications' | 'navigation'>('dashboard');
  const [historySubTab, setHistorySubTab] = useState<'deliveries' | 'routes'>('deliveries');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeToast, setActiveToast] = useState<ChatToast | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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

  const prevNotesRef = useRef<Record<string, string>>({});
  const prevChatRef = useRef<Record<string, string>>({});
  const prevScheduleChatRef = useRef<Record<string, string>>({});

  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [launchForm, setLaunchForm] = useState({
    establishmentId: '',
    value: '',
    orderNumber: '',
    notes: ''
  });

  const [notesDeliveryId, setNotesDeliveryId] = useState<string | null>(null);
  const [customerChatDeliveryId, setCustomerChatDeliveryId] = useState<string | null>(null);
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  const [scheduleEstFilter, setScheduleEstFilter] = useState('');
  const [scheduleDateFilter, setScheduleDateFilter] = useState('');

  // --- FILTROS DE TURNO INTELIGENTE NO HISTÓRICO ---
  const [filterMode, setFilterMode] = useState<'smart_shift' | 'date_range' | 'all'>('smart_shift');
  const [smartDate, setSmartDate] = useState<string>(db.getOperationalDateString());
  const [smartPeriod, setSmartPeriod] = useState<'all_shifts' | 'night_shift' | 'morning_shift' | 'afternoon_shift'>('all_shifts');
  
  const [historyEstFilter, setHistoryEstFilter] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<'all' | 'pending' | 'active' | 'rejected' | 'cancelled'>('all');

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
    const freshUser = allUsers.find(u => u.id === user.id) || user;
    
    const allSchedules = db.getSchedules().filter(s => {
      if (s.riderId === freshUser.id) return true;
      const riderOfSch = allUsers.find(u => u.id === s.riderId);
      return riderOfSch && riderOfSch.email.toLowerCase() === freshUser.email.toLowerCase();
    });

    const allDeliveries = db.getDeliveries().filter(d => {
      if (d.riderId === freshUser.id) return true;
      const riderOfDel = allUsers.find(u => u.id === d.riderId);
      return riderOfDel && riderOfDel.email.toLowerCase() === freshUser.email.toLowerCase();
    });

    const allNotifications = db.getNotifications().filter(n => {
      if (n.riderId === freshUser.id) return true;
      const riderOfNotif = allUsers.find(u => u.id === n.riderId);
      return riderOfNotif && riderOfNotif.email.toLowerCase() === freshUser.email.toLowerCase();
    });

    const allEsts = db.getEstablishments().filter(e => e.active);
    const myRoutes = db.getRouteHistory().filter(r => r.riderId === freshUser.id);
    
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

  useEffect(() => {
    deliveries.forEach(d => {
      const prevNotes = prevNotesRef.current[d.id];
      if (prevNotes !== undefined && d.notes && d.notes !== prevNotes) {
        const prevLines = prevNotes ? prevNotes.split('\n') : [];
        const currentLines = d.notes.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Motoboy') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const sender = line.includes('- Estabelecimento') ? 'Estabelecimento' : 'Admin';
              const messageText = line.substring(line.indexOf(']: ') + 3);
              const title = `Mensagem de ${sender} (Pedido #${d.orderNumber || d.id.slice(-4)})`;
              
              sendDeviceNotification(title, `"${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'notes_' + Date.now(),
                title,
                message: messageText,
                sender,
                onClick: () => setNotesDeliveryId(d.id)
              });
            }
          });
        }
      }
      prevNotesRef.current[d.id] = d.notes || '';
    });
  }, [deliveries, user]);

  useEffect(() => {
    deliveries.forEach(d => {
      const prevChat = prevChatRef.current[d.id];
      if (prevChat !== undefined && d.customerChat && d.customerChat !== prevChat) {
        const prevLines = prevChat ? prevChat.split('\n') : [];
        const currentLines = d.customerChat.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Motoboy') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const messageText = line.substring(line.indexOf(']: ') + 3);
              const title = `Mensagem do Cliente (Pedido #${d.orderNumber || d.id.slice(-4)})`;
              
              sendDeviceNotification(title, `"${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'customer_' + Date.now(),
                title,
                message: messageText,
                sender: 'Cliente',
                onClick: () => setCustomerChatDeliveryId(d.id)
              });
            }
          });
        }
      }
      prevChatRef.current[d.id] = d.customerChat || '';
    });
  }, [deliveries, user]);

  useEffect(() => {
    schedules.forEach(s => {
      const prevChat = prevScheduleChatRef.current[s.id];
      if (prevChat !== undefined && s.chat && s.chat !== prevChat) {
        const prevLines = prevChat ? prevChat.split('\n') : [];
        const currentLines = s.chat.split('\n');

        if (currentLines.length > prevLines.length) {
          const newLines = currentLines.slice(prevLines.length);
          newLines.forEach(line => {
            const isMe = line.includes('- Motoboy') || line.includes(`(${user?.name})`);
            if (!isMe) {
              const est = resolveEst(s.establishmentId);
              const messageText = line.substring(line.indexOf(']: ') + 3);
              const title = `Aviso no Turno (${est?.name || 'Estabelecimento'})`;
              
              sendDeviceNotification(title, `"${messageText}"`);
              playNotificationSound();
              setActiveToast({
                id: 'sch_' + Date.now(),
                title,
                message: messageText,
                sender: est?.name || 'Estabelecimento',
                onClick: () => setActiveScheduleChatId(s.id)
              });
            }
          });
        }
      }
      prevScheduleChatRef.current[s.id] = s.chat || '';
    });
  }, [schedules, user]);

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

  const todayDeliveries = deliveries.filter(d => isSameDayString(d.date, operationalTodayStr));
  const todayEarnings = todayDeliveries.filter(d => d.status === 'active').reduce((sum, d) => sum + Number(d.value || 0), 0);

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

  const getScheduledEstablishmentsToday = () => {
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

  // Estabelecimentos onde o motoboy já esteve ou está escalado (para o dropdown de filtro do histórico)
  const getRiderHistoryEstablishments = () => {
    const scheduledEstIds = new Set(schedules.map(s => s.establishmentId));
    const deliveryEstIds = new Set(deliveries.map(d => d.establishmentId));
    const allRelatedEstIds = new Set([...scheduledEstIds, ...deliveryEstIds]);

    return establishments.filter(e => 
      allRelatedEstIds.has(e.id) || 
      Array.from(allRelatedEstIds).some(id => db.isSameEstablishment(e.id, id))
    );
  };

  const handleLaunchDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const val = parseFloat(launchForm.value.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
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

    // Validação de duplicidade: impede que o mesmo pedido seja lançado mais de uma vez hoje por qualquer motoboy
    const dupCheck = db.checkDuplicateOrderNumber(cleanOrderNumber, operationalTodayStr, new Date().toTimeString().slice(0, 5), editingDelivery?.id);
    if (dupCheck.isDuplicate) {
      alert(`⚠️ Erro: O pedido #${cleanOrderNumber} já foi lançado hoje por ${dupCheck.riderName}.\n\nNão é permitido lançar mais de uma corrida com o mesmo número de pedido.`);
      return;
    }

    const allDeliveries = db.getDeliveries();
    const activeSchedule = schedules.find(s => db.isSameEstablishment(s.establishmentId, launchForm.establishmentId) && isSameDayString(s.date, operationalTodayStr));
    const nowStr = new Date().toISOString();

    if (editingDelivery) {
      const updated = allDeliveries.map(d => d.id === editingDelivery.id ? {
        ...d,
        establishmentId: launchForm.establishmentId,
        value: val,
        orderNumber: cleanOrderNumber,
        notes: launchForm.notes.trim() || undefined,
        scheduleId: activeSchedule?.id || d.scheduleId,
        updatedAt: nowStr
      } : d);

      await db.setDeliveries(updated);
      alert('Corrida atualizada com sucesso!');
    } else {
      const newDelivery: Delivery = {
        id: 'd_' + Date.now(),
        riderId: user.id,
        establishmentId: launchForm.establishmentId,
        date: operationalTodayStr,
        time: new Date().toTimeString().slice(0, 5),
        value: val,
        status: 'pending',
        scheduleId: activeSchedule?.id,
        orderNumber: cleanOrderNumber,
        notes: launchForm.notes.trim() || undefined,
        updatedAt: nowStr
      };

      await db.setDeliveries([...allDeliveries, newDelivery]);
      alert(`🎉 Corrida #${cleanOrderNumber} lançada com sucesso! Aguardando aprovação.`);
    }

    setShowLaunchModal(false);
    setEditingDelivery(null);
    setLaunchForm({ establishmentId: '', value: '', orderNumber: '', notes: '' });
    loadData();
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

  const filteredTodayDeliveries = todayDeliveries.filter(d => {
    if (deliveryStatusFilter === 'all') return true;
    return d.status === deliveryStatusFilter;
  });

  // Filtro Inteligente do Histórico usando getDeliveryOperationalDate
  const historyDeliveries = deliveries.filter(d => {
    let matchesEst = true;
    if (historyEstFilter) {
      matchesEst = db.isSameEstablishment(d.establishmentId, historyEstFilter);
    }
    if (!matchesEst) return false;

    if (filterMode === 'smart_shift') {
      if (!smartDate) return true;
      const opDate = getDeliveryOperationalDate(d.date, d.time);
      const isDateMatch = isSameDayString(opDate, smartDate);
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

  const historyTotalEarnings = historyDeliveries
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + Number(d.value || 0), 0);

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
                if (scheduledEstsToday.length === 0) {
                  alert('Aviso: Você não possui escalas ativas hoje neste turno. Fale com o administrador.');
                  return;
                }
                setEditingDelivery(null);
                setLaunchForm({ establishmentId: scheduledEstsToday[0].id, value: '', orderNumber: '', notes: '' });
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

        <div className="grid grid-cols-5 bg-white rounded-lg p-1 shadow-sm mb-6 border border-slate-200 gap-1 text-xs sm:text-sm sticky top-[68px] z-20">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Início</span>
          </button>
          <button
            onClick={() => setActiveTab('navigation')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'navigation' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Compass className="h-4 w-4 text-emerald-400" />
            <span>GPS App</span>
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'schedules' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Escalas</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 transition-colors ${
              activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Histórico</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2.5 font-medium rounded-md flex items-center justify-center space-x-1 relative ${
              activeTab === 'notifications' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
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
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Faturado Hoje</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {todayEarnings.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Corridas Aprovadas Hoje</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {todayDeliveries.filter(d => d.status === 'active').length}
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
                      <div className="bg-white/10 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                  <p className="font-bold text-sm">Escalas Futuras</p>
                  <p className="text-xs text-amber-700 mt-0.5">Você não possui escalas para hoje. Verifique na aba "Escalas" seus próximos turnos.</p>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-indigo-600" />
                  <span>Corridas de Hoje</span>
                </h3>
                
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium">Filtrar:</span>
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
                  <p>Nenhuma corrida encontrada para este filtro.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredTodayDeliveries.map((delivery) => {
                    const est = resolveEst(delivery.establishmentId);
                    const hasNotes = Boolean(delivery.notes && delivery.notes.trim());
                    const notesCount = delivery.notes ? delivery.notes.split('\n').filter(l => l.trim()).length : 0;

                    return (
                      <div key={delivery.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {delivery.orderNumber && (
                              <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex-shrink-0 tracking-wide">
                                #{delivery.orderNumber}
                              </span>
                            )}
                            <p className="font-bold text-slate-800 text-sm">{est?.name || 'Estabelecimento'}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Todos os Estabelecimentos</option>
                    {establishments.map(est => (
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

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-600" />
                  <span>Histórico Geral</span>
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
                  {/* CARD DE FILTRO DE TURNO E PERÍODO */}
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
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Até (Data Final)</label>
                          <input
                            type="date"
                            value={historyDateTo}
                            onChange={(e) => setHistoryDateTo(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Filtrar por Estabelecimento ({riderHistoryEsts.length} disponível{riderHistoryEsts.length !== 1 ? 'is' : ''})
                      </label>
                      <select
                        value={historyEstFilter}
                        onChange={(e) => setHistoryEstFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Todos os Meus Estabelecimentos Escalados</option>
                        {riderHistoryEsts.map(est => (
                          <option key={est.id} value={est.id}>{est.name}</option>
                        ))}
                      </select>
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
                    <div className="divide-y divide-slate-100">
                      {historyDeliveries.map((del) => {
                        const est = resolveEst(del.establishmentId);
                        const hasNotes = Boolean(del.notes && del.notes.trim());
                        const notesCount = del.notes ? del.notes.split('\n').filter(l => l.trim()).length : 0;

                        return (
                          <div key={del.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-lg">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {del.orderNumber && (
                                  <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex-shrink-0 tracking-wide">
                                    #{del.orderNumber}
                                  </span>
                                )}
                                <p className="font-bold text-slate-800 text-sm">{est?.name || 'Estabelecimento'}</p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                        );
                      })}
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

      {/* Modal de Lançamento de Corrida pelo Motoboy */}
      {showLaunchModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
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
                <p className="text-[10px] text-slate-400 mt-1">
                  Digite somente números (ex: 12, 104, 1042). O sistema valida se já foi lançado hoje.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Valor da Corrida (R$)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={launchForm.value}
                    onChange={(e) => setLaunchForm({ ...launchForm, value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Observações / Instruções (Opcional)
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
                  onClick={() => { setShowLaunchModal(false); setEditingDelivery(null); }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md"
                >
                  {editingDelivery ? 'Salvar Alterações' : 'Lançar Corrida'}
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