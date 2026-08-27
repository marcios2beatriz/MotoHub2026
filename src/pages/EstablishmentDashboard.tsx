"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Delivery, User, Schedule, RiderLocation, Establishment, getDeliveryOperationalDate, isSameDayString } from '../utils/db';
import { 
  LogOut, 
  Check, 
  CheckCheck,
  Plus, 
  Bike, 
  Users,
  DollarSign,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  MessageSquare,
  Share2,
  Edit2,
  Trash2,
  LocateFixed,
  AlertTriangle,
  RotateCw,
  Ban,
  Calendar,
  Filter,
  Layers,
  Sparkles,
  Hash,
  FileText,
  Link2,
  Banknote,
  CreditCard,
  QrCode,
  Wallet,
  Receipt,
  Coins,
  ArrowUpDown,
  Search
} from 'lucide-react';
import L from 'leaflet';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import DeliveryModal from '../components/DeliveryModal';
import BatchDeliveryModal from '../components/BatchDeliveryModal';
import ChatToastBanner, { ChatToast } from '../components/ChatToastBanner';
import { sendDeviceNotification, playNotificationSound, requestNotificationPermission } from '../utils/notifications';
import { realtimeGps } from '../utils/realtimeGps';

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;
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

export default function EstablishmentDashboard() {
  const navigate = useNavigate();
  const [user] = useState(db.getCurrentUser());

  // Aba ativa: 'operations' (Visão e Corridas) ou 'finance' (Fechamento Financeiro e Repasses)
  const [activeMainTab, setActiveMainTab] = useState<'operations' | 'finance'>('operations');

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [allRiders, setAllRiders] = useState<User[]>([]);
  const [establishmentSchedules, setEstablishmentSchedules] = useState<Schedule[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [currentEst, setCurrentEst] = useState<Establishment | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeToast, setActiveToast] = useState<ChatToast | null>(null);

  // Monitoramento de novas mensagens
  const prevNotesRef = useRef<{ [deliveryId: string]: string }>({});
  const prevScheduleChatsRef = useRef<{ [scheduleId: string]: string }>({});

  // Filtros de corridas operacionais
  const [filterMode, setFilterMode] = useState<'smart_shift' | 'date_range' | 'all'>('smart_shift');
  const [smartDate, setSmartDate] = useState<string>(db.getOperationalDateString());
  const [smartPeriod, setSmartPeriod] = useState<'all_shifts' | 'night_shift' | 'morning_shift' | 'afternoon_shift'>('all_shifts');

  const [riderFilter, setRiderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [featureFilter, setFeatureFilter] = useState<'all' | 'with_additional' | 'linked' | 'standard'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'to_collect' | 'money' | 'card' | 'pix' | 'already_paid'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [orderNumberFilter, setOrderNumberFilter] = useState<string>('');
  const [notesFilter, setNotesFilter] = useState<'all' | 'with_notes' | 'without_notes'>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'highest_value'>('recent');

  // --- Filtros do Painel Financeiro do Estabelecimento ---
  const [financePeriodMode, setFinancePeriodMode] = useState<'this_week' | 'last_week' | 'today' | 'this_month' | 'custom'>('this_week');
  const [financeCustomFrom, setFinanceCustomFrom] = useState<string>('');
  const [financeCustomTo, setFinanceCustomTo] = useState<string>('');
  const [financeRiderFilter, setFinanceRiderFilter] = useState<string>('all');
  const [financePaidFilter, setFinancePaidFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [financeFeatureFilter, setFinanceFeatureFilter] = useState<'all' | 'with_additional' | 'linked' | 'standard'>('all');
  const [financeSearchRider, setFinanceSearchRider] = useState<string>('');

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    riderId: '',
    establishmentId: '',
    date: db.getOperationalDateString(),
    time: new Date().toTimeString().slice(0, 5),
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
  const [activeScheduleChatId, setActiveScheduleChatId] = useState<string | null>(null);

  // Mapa GPS
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const hasSetInitialMapBoundsRef = useRef(false);

  const todayStr = db.getOperationalDateString();

  const loadData = () => {
    if (!user) return;

    let estFound: Establishment | undefined;
    if (user.establishmentId) {
      estFound = db.getEstablishments().find(e => e.id === user.establishmentId);
    }
    
    if (!estFound && user.email) {
      estFound = db.getEstablishments().find(e => e.email?.toLowerCase() === user.email.toLowerCase());
    }

    if (!estFound) {
      setCurrentEst(null);
      return;
    }

    setCurrentEst(estFound);

    const estDeliveries = db.getDeliveries().filter(d => 
      db.isSameEstablishment(d.establishmentId, estFound!.id)
    );

    const riders = db.getUsers().filter(u => u.role === 'rider' && u.active);
    const schedules = db.getSchedules().filter(s => 
      db.isSameEstablishment(s.establishmentId, estFound!.id)
    );
    const locations = db.getRiderLocations();

    // Notificação de novas mensagens
    estDeliveries.forEach(del => {
      const prevNote = prevNotesRef.current[del.id];
      if (prevNote !== undefined && del.notes && del.notes !== prevNote) {
        const prevLines = prevNote.split('\n');
        const currentLines = del.notes.split('\n');
        if (currentLines.length > prevLines.length) {
          const lastMsg = currentLines[currentLines.length - 1];
          if (!lastMsg.includes('- Estabelecimento')) {
            const sender = lastMsg.includes('- Motoboy') ? 'Motoboy' : 'Admin';
            const msgContent = lastMsg.includes(']: ') ? lastMsg.substring(lastMsg.indexOf(']: ') + 3) : lastMsg;
            
            playNotificationSound();
            sendDeviceNotification(`Nova observação de ${sender}`, `Pedido #${del.orderNumber || del.id.slice(-4)}: "${msgContent}"`);
            setActiveToast({
              id: 'toast-est-' + Date.now(),
              title: `Mensagem de ${sender} - Pedido #${del.orderNumber || del.id.slice(-4)}`,
              message: msgContent,
              sender,
              onClick: () => setNotesDeliveryId(del.id)
            });
          }
        }
      }
      prevNotesRef.current[del.id] = del.notes || '';
    });

    schedules.forEach(sch => {
      const prevSchChat = prevScheduleChatsRef.current[sch.id];
      if (prevSchChat !== undefined && sch.chat && sch.chat !== prevSchChat) {
        const prevLines = prevSchChat.split('\n');
        const currentLines = sch.chat.split('\n');
        if (currentLines.length > prevLines.length) {
          const lastMsg = currentLines[currentLines.length - 1];
          if (!lastMsg.includes('- Estabelecimento')) {
            const sender = lastMsg.includes('- Motoboy') ? 'Motoboy' : 'Admin';
            const msgContent = lastMsg.includes(']: ') ? lastMsg.substring(lastMsg.indexOf(']: ') + 3) : lastMsg;
            
            playNotificationSound();
            sendDeviceNotification(`Aviso no Chat de Turno (${sender})`, msgContent);
            setActiveToast({
              id: 'toast-est-sch-' + Date.now(),
              title: `Aviso do Turno - ${sender}`,
              message: msgContent,
              sender,
              onClick: () => setActiveScheduleChatId(sch.id)
            });
          }
        }
      }
      prevScheduleChatsRef.current[sch.id] = sch.chat || '';
    });

    setDeliveries([...estDeliveries].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)));
    setAllRiders(riders);
    setEstablishmentSchedules([...schedules].sort((a, b) => b.date.localeCompare(a.date)));
    setRiderLocations(locations);
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    requestNotificationPermission();
    loadData();
    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadData());
    }, 2500);

    const handleDataUpdate = () => loadData();
    window.addEventListener('db-sync-complete', handleDataUpdate);

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
      window.removeEventListener('db-sync-complete', handleDataUpdate);
      unsubscribeLocation();
      unsubscribeOffline();
    };
  }, [user, navigate]);

  const todaySchedulesRaw = establishmentSchedules.filter(s => isSameDayString(s.date, todayStr));
  
  const todaySchedules: Schedule[] = [];
  const seenRiders = new Set<string>();
  todaySchedulesRaw.forEach(s => {
    if (!seenRiders.has(s.riderId)) {
      seenRiders.add(s.riderId);
      todaySchedules.push(s);
    }
  });

  const scheduledRiderIds = new Set(todaySchedules.map(s => {
    const r = db.resolveUser(s.riderId);
    return r ? r.id : s.riderId;
  }));

  const onlineScheduledRiderLocations = riderLocations.filter(loc => {
    if (!loc.lat || !loc.lng || isNaN(loc.lat) || isNaN(loc.lng)) return false;
    
    const isScheduled = scheduledRiderIds.has(loc.riderId) || 
      todaySchedules.some(s => db.isSameUser(s.riderId, loc.riderId));
    if (!isScheduled) return false;

    const timeDiff = loc.updatedAt ? Date.now() - new Date(loc.updatedAt).getTime() : Infinity;
    return timeDiff <= ONLINE_THRESHOLD_MS;
  });

  const handleRecenterMap = () => {
    const currentMap = mapRef.current;
    if (!currentMap) return;
    const points: L.LatLngExpression[] = [];

    onlineScheduledRiderLocations.forEach(loc => {
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
    if (!mapContainerRef.current) return;

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

    const allowedIds = new Set(onlineScheduledRiderLocations.map(r => r.riderId));

    Object.keys(markersRef.current).forEach(markerId => {
      if (!allowedIds.has(markerId)) {
        currentMap.removeLayer(markersRef.current[markerId]);
        delete markersRef.current[markerId];
      }
    });

    onlineScheduledRiderLocations.forEach(loc => {
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
        className: 'custom-est-rider-icon',
        iconSize: [90, 60],
        iconAnchor: [45, 50]
      });

      if (existingMarker) {
        existingMarker.setLatLng([loc.lat, loc.lng]);
        existingMarker.setIcon(riderIcon);
      } else {
        const marker = L.marker([loc.lat, loc.lng], { icon: riderIcon })
          .addTo(currentMap)
          .bindPopup(`<b>${riderName}</b><br/>🟢 Sinal GPS Ativo em tempo real`);
        markersRef.current[loc.riderId] = marker;
      }
    });

    if (!hasSetInitialMapBoundsRef.current && points.length > 0) {
      if (points.length >= 2) {
        currentMap.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
      } else if (points.length === 1) {
        currentMap.setView(points[0], 16);
      }
      hasSetInitialMapBoundsRef.current = true;
    }
  }, [onlineScheduledRiderLocations]);

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [isMapExpanded, activeMainTab]);

  const handleLogout = () => {
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

  const handleApproveDelivery = async (id: string) => {
    const allDeliveries = db.getDeliveries();
    const deliveryToApprove = allDeliveries.find(d => d.id === id);

    if (deliveryToApprove) {
      const pm = deliveryToApprove.paymentMethod || 'already_paid';
      const rider = db.resolveUser(deliveryToApprove.riderId);
      const riderName = rider?.name || 'o motoboy';
      const orderNum = deliveryToApprove.orderNumber ? `#${deliveryToApprove.orderNumber}` : '';
      const amountStr = deliveryToApprove.orderCollectionAmount ? `R$ ${Number(deliveryToApprove.orderCollectionAmount).toFixed(2)}` : 'o valor do pedido';

      if (pm === 'money') {
        const changeMsg = deliveryToApprove.changeFor ? ` (levou troco para R$ ${Number(deliveryToApprove.changeFor).toFixed(2)})` : '';
        const confirmed = confirm(
          `💰 CONFERÊNCIA DE COBRANÇA EM DINHEIRO:\n\n` +
          `Pedido: ${orderNum}\n` +
          `Entregador: ${riderName}\n` +
          `Valor a receber do cliente: ${amountStr}${changeMsg}\n\n` +
          `👉 O entregador ${riderName} já repassou este dinheiro para o caixa do estabelecimento?\n\n` +
          `Clique em "OK" apenas se já recebeu o dinheiro para aprovar a corrida.`
        );
        if (!confirmed) return;
      } else if (pm === 'card_debit' || pm === 'card_credit') {
        const tipoCartao = pm === 'card_debit' ? 'DÉBITO' : 'CRÉDITO';
        const confirmed = confirm(
          `💳 CONFERÊNCIA DE MAQUINETA E PAGAMENTO NO CARTÃO (${tipoCartao}):\n\n` +
          `Pedido: ${orderNum}\n` +
          `Entregador: ${riderName}\n` +
          `Valor cobrado: ${amountStr}\n\n` +
          `👉 O entregador ${riderName} já devolveu a maquineta de cartão e comprovante do pedido para o estabelecimento?\n\n` +
          `Clique em "OK" para confirmar a devolução da maquineta e aprovar a corrida.`
        );
        if (!confirmed) return;
      } else if (pm === 'pix_delivery') {
        const confirmed = confirm(
          `📱 CONFERÊNCIA DE PAGAMENTO VIA PIX NA ENTREGA:\n\n` +
          `Pedido: ${orderNum}\n` +
          `Valor do PIX: ${amountStr}\n\n` +
          `👉 O comprovante de PIX do cliente já foi conferido na conta do estabelecimento?\n\n` +
          `Clique em "OK" para confirmar o recebimento e aprovar a corrida.`
        );
        if (!confirmed) return;
      }
    }

    const updated = allDeliveries.map(d => d.id === id ? { ...d, status: 'active' as const, updatedAt: new Date().toISOString() } : d);
    await db.setDeliveries(updated);
    loadData();
  };

  const handleApproveAllPendingDeliveries = async () => {
    const pendingDels = deliveries.filter(d => d.status === 'pending');
    if (pendingDels.length === 0) {
      alert('Não há corridas pendentes para aprovar no momento.');
      return;
    }

    const cobrarCount = pendingDels.filter(d => d.paymentMethod && d.paymentMethod !== 'already_paid').length;
    let confirmMsg = `Deseja aprovar todas as ${pendingDels.length} corridas pendentes deste estabelecimento de uma vez?`;
    if (cobrarCount > 0) {
      confirmMsg += `\n\n💰 ATENÇÃO: ${cobrarCount} corrida(s) possuem cobrança ao cliente (dinheiro, maquininha ou PIX).\n\nAo clicar em "OK", todas as corridas serão aprovadas normalmente. Certifique-se de que os valores e maquinetas foram devidamente conferidos.`;
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
      alert(`${pendingDels.length} corrida(s) aprovada(s) com sucesso!`);
    }
  };

  const handleRejectDelivery = async (id: string) => {
    const reason = prompt('Digite o motivo da rejeição:');
    if (reason !== null) {
      const allDeliveries = db.getDeliveries();
      const updated = allDeliveries.map(d => d.id === id ? {
        ...d,
        status: 'rejected' as const,
        notes: d.notes ? `${d.notes}\nRejeitado: ${reason}` : `Rejeitado: ${reason}`,
        updatedAt: new Date().toISOString()
      } : d);
      await db.setDeliveries(updated);
      loadData();
    }
  };

  const handleDeleteDelivery = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta corrida definitivamente? Esta ação não pode ser desfeita.')) {
      await db.deleteDelivery(id);
      loadData();
    }
  };

  const handleOpenLaunchModal = (riderIdToPreselect?: string) => {
    if (!currentEst) return;
    setEditingDelivery(null);
    setDeliveryForm({
      riderId: riderIdToPreselect || (allRiders.length > 0 ? allRiders[0].id : ''),
      establishmentId: currentEst.id,
      date: todayStr,
      time: new Date().toTimeString().slice(0, 5),
      value: '8.00',
      orderNumber: '',
      notes: '',
      deliveryType: 'standard',
      additionalValue: '',
      additionalReason: '',
      linkedOrderNumber: '',
      paymentMethod: 'already_paid',
      orderCollectionAmount: '',
      changeFor: ''
    });
    setShowDeliveryModal(true);
  };

  const handleEditDelivery = (del: Delivery) => {
    if (!currentEst) return;
    setEditingDelivery(del);
    setDeliveryForm({
      riderId: del.riderId,
      establishmentId: del.establishmentId,
      date: del.date,
      time: del.time,
      value: (del.deliveryType === 'same_address' ? '4.00' : '8.00'),
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
  };

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEst || isSubmittingDelivery) return;

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
          `Deseja confirmar o lançamento desta corrida dividida/adicional mesmo assim?`
        );
        if (!confirmDuplicate) {
          return;
        }
      }
    }

    setIsSubmittingDelivery(true);

    try {
      const allDeliveries = db.getDeliveries();
      const nowStr = new Date().toISOString();

      const collectionAmount = deliveryForm.orderCollectionAmount ? parseFloat(deliveryForm.orderCollectionAmount.replace(',', '.')) : undefined;
      const changeForValue = deliveryForm.changeFor ? parseFloat(deliveryForm.changeFor.replace(',', '.')) : undefined;

      if (editingDelivery) {
        const updated = allDeliveries.map(d => d.id === editingDelivery.id ? {
          ...d,
          riderId: deliveryForm.riderId,
          date: deliveryForm.date,
          time: deliveryForm.time,
          value: finalVal,
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
          establishmentId: currentEst.id,
          date: deliveryForm.date,
          time: deliveryForm.time,
          value: finalVal,
          status: 'active',
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
        await db.setDeliveries([...allDeliveries, newDelivery]);
      }

      setShowDeliveryModal(false);
      setEditingDelivery(null);
      loadData();
    } catch (err) {
      console.error('Erro ao gravar corrida:', err);
      alert('Erro ao salvar corrida. Tente novamente.');
    } finally {
      setIsSubmittingDelivery(false);
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

  const setEstSmartDateToToday = () => {
    setSmartDate(db.getOperationalDateString());
  };

  const setEstSmartDateToYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSmartDate(db.getOperationalDateString(d));
  };

  // --- Lógica de Repasse / Baixa Financeira de Corridas do Estabelecimento ---
  const handleSettleRiderInEst = async (riderId: string, deliveryIds: string[]) => {
    const rider = db.resolveUser(riderId);
    if (!rider) return;

    if (confirm(`Deseja marcar as ${deliveryIds.length} corrida(s) do motoboy ${rider.name} como PAGAS/BAIXADAS neste estabelecimento?`)) {
      const allDeliveries = db.getDeliveries();
      const idSet = new Set(deliveryIds);
      const updated = allDeliveries.map(d => idSet.has(d.id) ? {
        ...d,
        paid: true,
        updatedAt: new Date().toISOString()
      } : d);

      await db.setDeliveries(updated);
      loadData();
      alert(`Corridas de ${rider.name} marcadas como pagas com sucesso!`);
    }
  };

  const handleUnsettleRiderInEst = async (riderId: string, deliveryIds: string[]) => {
    const rider = db.resolveUser(riderId);
    if (!rider) return;

    if (confirm(`Deseja reverter e marcar as corridas de ${rider.name} como PENDENTES DE REPASSE?`)) {
      const allDeliveries = db.getDeliveries();
      const idSet = new Set(deliveryIds);
      const updated = allDeliveries.map(d => idSet.has(d.id) ? {
        ...d,
        paid: false,
        updatedAt: new Date().toISOString()
      } : d);

      await db.setDeliveries(updated);
      loadData();
    }
  };

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

  if (user && !currentEst && db.getEstablishments().length > 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md space-y-4">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto" />
          <h2 className="text-xl font-black text-slate-800">Estabelecimento não localizado</h2>
          <p className="text-sm text-slate-600">Seu usuário de gerente ainda não possui um estabelecimento vinculado. Fale com o administrador do sistema.</p>
          <button onClick={handleLogout} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Voltar para Login</button>
        </div>
      </div>
    );
  }

  const todayDeliveries = deliveries.filter(d => isSameDayString(d.date, todayStr));
  const todayApprovedDeliveries = todayDeliveries.filter(d => d.status === 'active');
  const todayRevenue = todayApprovedDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const onlineRidersCount = onlineScheduledRiderLocations.length;
  const pendingDeliveries = deliveries.filter(d => d.status === 'pending');

  const filteredDeliveries = deliveries
    .filter(d => {
      const hasNotes = Boolean(d.notes && d.notes.trim().length > 0);
      if (notesFilter === 'with_notes' && !hasNotes) return false;
      if (notesFilter === 'without_notes' && hasNotes) return false;

      // Filtro de com adicional / vinculado / padrão
      if (featureFilter === 'with_additional') {
        const hasAdd = Number(d.additionalValue || 0) > 0;
        if (!hasAdd) return false;
      } else if (featureFilter === 'linked') {
        const isLinked = d.deliveryType === 'same_address' || Boolean(d.linkedOrderNumber);
        if (!isLinked) return false;
      } else if (featureFilter === 'standard') {
        const isStandard = d.deliveryType !== 'same_address' && !d.linkedOrderNumber && (!d.additionalValue || Number(d.additionalValue) <= 0);
        if (!isStandard) return false;
      }

      // Filtro de Cobrança ao Cliente / Forma de Pagamento
      if (paymentFilter === 'to_collect') {
        const isCollect = d.paymentMethod && d.paymentMethod !== 'already_paid';
        if (!isCollect) return false;
      } else if (paymentFilter === 'money') {
        if (d.paymentMethod !== 'money') return false;
      } else if (paymentFilter === 'card') {
        if (d.paymentMethod !== 'card_debit' && d.paymentMethod !== 'card_credit') return false;
      } else if (paymentFilter === 'pix') {
        if (d.paymentMethod !== 'pix_delivery') return false;
      } else if (paymentFilter === 'already_paid') {
        if (d.paymentMethod && d.paymentMethod !== 'already_paid') return false;
      }

      if (orderNumberFilter.trim()) {
        const cleanTarget = orderNumberFilter.trim().toLowerCase().replace('#', '');
        const orderNum = (d.orderNumber || '').toLowerCase().replace('#', '');
        const delId = d.id.toLowerCase();
        if (!orderNum.includes(cleanTarget) && !delId.includes(cleanTarget)) return false;
      }

      if (riderFilter !== 'all' && d.riderId !== riderFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;

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
        if (dateFrom && d.date < dateFrom) return false;
        if (dateTo && d.date > dateTo) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'recent') return b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.id.localeCompare(a.id);
      if (sortOrder === 'oldest') return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id);
      if (sortOrder === 'highest_value') return Number(b.value || 0) - Number(a.value || 0);
      return 0;
    });

  // --- LÓGICA DO FECHAMENTO FINANCEIRO DO ESTABELECIMENTO ---
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

    if (financeRiderFilter !== 'all' && !db.isSameUser(d.riderId, financeRiderFilter)) return false;

    if (financePaidFilter === 'unpaid' && d.paid) return false;
    if (financePaidFilter === 'paid' && !d.paid) return false;

    if (financeFeatureFilter === 'with_additional' && (!d.additionalValue || Number(d.additionalValue) <= 0)) return false;
    if (financeFeatureFilter === 'linked' && (d.deliveryType !== 'same_address' && !d.linkedOrderNumber)) return false;
    if (financeFeatureFilter === 'standard' && (d.deliveryType === 'same_address' || Boolean(d.linkedOrderNumber) || (d.additionalValue && Number(d.additionalValue) > 0))) return false;

    return true;
  });

  const totalFinanceDeliveriesCount = financeFilteredDeliveries.length;
  const totalFinanceGrossCharged = financeFilteredDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
  
  // Taxa do administrador (R$ 1,00 por corrida padrão, R$ 0,00 para R$ 4,00 mesmo endereço)
  const totalFinanceAdminCut = financeFilteredDeliveries.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
  const totalFinanceRidersNet = Math.max(0, totalFinanceGrossCharged - totalFinanceAdminCut);
  const totalFinanceAdditionals = financeFilteredDeliveries.reduce((sum, d) => sum + Number(d.additionalValue || 0), 0);

  // Lista de motoboys únicos que fizeram corridas no período para o estabelecimento
  const uniqueRiderIds = Array.from(new Set(deliveries.map(d => d.riderId)));
  const ridersWithDeliveries = uniqueRiderIds
    .map(id => db.resolveUser(id))
    .filter((u): u is User => !!u)
    .filter(r => r.name.toLowerCase().includes(financeSearchRider.toLowerCase()) || r.phone.includes(financeSearchRider));

  const activeNotesDelivery = db.getDeliveries().find(d => d.id === notesDeliveryId) || null;
  const activeScheduleChat = db.getSchedules().find(s => s.id === activeScheduleChatId) || null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-12">
      <ChatToastBanner toast={activeToast} onClose={() => setActiveToast(null)} />

      {/* Header Principal do Estabelecimento */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Bike className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-extrabold leading-tight text-white">{currentEst?.name || 'Estabelecimento'}</h1>
              <p className="text-[11px] text-slate-400 font-medium">Gestão, Rastreio & Fechamento Financeiro</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {pendingDeliveries.length > 0 && (
              <button
                onClick={handleApproveAllPendingDeliveries}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-md animate-pulse"
                title="Aprovar todas as corridas pendentes deste estabelecimento"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden xs:inline">Aprovar em Massa</span> ({pendingDeliveries.length})
              </button>
            )}
            <button
              onClick={() => setShowBatchModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
              title="Lançar múltiplas corridas em lote"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lançar em Lote</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navegação entre Abas Principais: Operações & Rastreio VS Fechamento de Pagamentos */}
      <div className="max-w-7xl w-full mx-auto px-4 mt-4">
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-1.5">
          <button
            onClick={() => setActiveMainTab('operations')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
              activeMainTab === 'operations'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Bike className="h-4 w-4" />
            <span>Operações, Corridas & Rastreamento</span>
            {pendingDeliveries.length > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                {pendingDeliveries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveMainTab('finance')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
              activeMainTab === 'finance'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-200/60'
            }`}
          >
            <Wallet className="h-4 w-4 text-emerald-600" />
            <span>Fechamento & Pagamento aos Motoboys</span>
          </button>
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: OPERAÇÕES, CORRIDAS E MAPA GPS */}
      {activeMainTab === 'operations' && (
        <main className="max-w-7xl w-full mx-auto px-4 mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex items-center space-x-3">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-xl flex-shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MOTOBOYS HOJE</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight mt-0.5">{todaySchedules.length}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex items-center space-x-3">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl flex-shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL HOJE</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight mt-0.5">R$ {todayRevenue.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex items-center space-x-3">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl flex-shrink-0">
                  <Bike className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CORRIDAS HOJE</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight mt-0.5">{todayApprovedDeliveries.length}</p>
                </div>
              </div>
            </div>

            {/* ALERTA DE CORRIDAS PENDENTES COM BOTÃO DE APROVAÇÃO EM MASSA */}
            {pendingDeliveries.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-black flex-shrink-0 animate-pulse">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-950">
                      Você tem {pendingDeliveries.length} corrida(s) aguardando aprovação
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Aprove individualmente ou utilize a aprovação em massa com um único clique.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleApproveAllPendingDeliveries}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all flex-shrink-0 active:scale-95"
                >
                  <CheckCheck className="h-4 w-4" />
                  <span>Aprovar em Massa ({pendingDeliveries.length})</span>
                </button>
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-extrabold text-slate-800 text-base">
                    Motoboys Escalados Hoje ({todaySchedules.length})
                  </h3>
                </div>

                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  {pendingDeliveries.length > 0 && (
                    <button
                      onClick={handleApproveAllPendingDeliveries}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center space-x-1"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Aprovar em Massa ({pendingDeliveries.length})</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Lançamento em Lote</span>
                  </button>

                  <button
                    onClick={() => handleOpenLaunchModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center space-x-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Lançar Corrida</span>
                  </button>
                </div>
              </div>

              {todaySchedules.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Nenhum motoboy escalado para este estabelecimento hoje.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {todaySchedules.map((sch) => {
                    const rider = db.resolveUser(sch.riderId);
                    const riderDeliveries = todayApprovedDeliveries.filter(d => d.riderId === sch.riderId);
                    const riderTotalVal = riderDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);

                    const loc = riderLocations.find(l => l.riderId === sch.riderId);
                    const isOnline = loc && loc.updatedAt && (Date.now() - new Date(loc.updatedAt).getTime() < ONLINE_THRESHOLD_MS);

                    return (
                      <div key={sch.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center flex-shrink-0">
                              {rider?.name ? rider.name.charAt(0).toUpperCase() : 'M'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-sm truncate">{rider?.name || 'Motoboy'}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{rider?.phone || 'Sem telefone'}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <button
                              onClick={() => handleOpenLaunchModal(sch.riderId)}
                              className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                              title="Lançar Corrida para este Motoboy"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Lançar</span>
                            </button>
                            <button
                              onClick={() => setActiveScheduleChatId(sch.id)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                              title="Chat do Turno"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                            <span 
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} 
                              title={isOnline ? 'GPS Ativo Online' : 'GPS Offline'}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Corridas</p>
                            <p className="text-base font-black text-slate-800 mt-0.5">{riderDeliveries.length}</p>
                          </div>
                          <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                            <p className="text-base font-black text-emerald-600 mt-0.5">R$ {riderTotalVal.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-indigo-600" />
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base">
                      Corridas Lançadas e Histórico ({filteredDeliveries.length})
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Acesse todas as corridas registradas no estabelecimento por período e status
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  {pendingDeliveries.length > 0 && (
                    <button
                      onClick={handleApproveAllPendingDeliveries}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5"
                      title="Aprovar todas as corridas pendentes"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Aprovar em Massa ({pendingDeliveries.length})</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 self-start sm:self-center"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Lançar em Lote</span>
                  </button>
                </div>
              </div>

              {/* PAINEL DE FILTRO */}
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
                          onClick={setEstSmartDateToToday}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                        >
                          Hoje
                        </button>
                        <button
                          type="button"
                          onClick={setEstSmartDateToYesterday}
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
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Até (Data Final)</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
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
                        value={orderNumberFilter}
                        onChange={(e) => setOrderNumberFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-indigo-200 bg-indigo-50/50 rounded-lg text-xs font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <Hash className="h-3.5 w-3.5 text-indigo-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  {/* FILTRO: COBRANÇA AO CLIENTE / PAGAMENTO */}
                  <div>
                    <label className="block text-[10px] font-black text-amber-800 uppercase mb-1 flex items-center gap-1">
                      <Banknote className="h-3 w-3 text-amber-600" />
                      <span>Cobrar do Cliente</span>
                    </label>
                    <select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value as any)}
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
                      <span>Tipo / Adicional</span>
                    </label>
                    <select
                      value={featureFilter}
                      onChange={(e) => setFeatureFilter(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-purple-300 bg-purple-50/50 rounded-lg text-xs font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="all">Todos os Tipos</option>
                      <option value="with_additional">✨ Com Adicional</option>
                      <option value="linked">🔗 Vinculadas (Mesmo Endereço)</option>
                      <option value="standard">Padrão</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span>Filtro de Observações</span>
                    </label>
                    <select
                      value={notesFilter}
                      onChange={(e) => setNotesFilter(e.target.value as any)}
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
                      value={riderFilter}
                      onChange={(e) => setRiderFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Todos os Motoboys</option>
                      {allRiders.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status da Corrida</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                    >
                      <option value="all">Todos os Status</option>
                      <option value="active">Aprovadas (Ativas)</option>
                      <option value="pending">Pendentes de Aprovação</option>
                      <option value="rejected">Rejeitadas</option>
                      <option value="cancelled">Canceladas</option>
                    </select>
                  </div>
                </div>
              </div>

              {filteredDeliveries.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  Nenhuma corrida encontrada para os filtros selecionados.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredDeliveries.map((del) => {
                    const rider = db.resolveUser(del.riderId);
                    const hasNotes = Boolean(del.notes && del.notes.trim());
                    const notesCount = del.notes ? del.notes.split('\n').filter(l => l.trim()).length : 0;
                    const isSame = del.deliveryType === 'same_address';
                    const hasAdditional = Number(del.additionalValue || 0) > 0;

                    return (
                      <div key={del.id} className={`py-3.5 flex flex-col space-y-1.5 text-xs ${isSame ? 'bg-purple-50/30 p-2.5 rounded-xl border border-purple-100' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              {del.orderNumber && (
                                <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                                  #{del.orderNumber}
                                </span>
                              )}
                              <p className="font-extrabold text-slate-800 text-sm truncate">{rider?.name || 'Motoboy'}</p>

                              {/* Badge Mesmo Endereço com Vinculação */}
                              {isSame && (
                                <span className="bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                  <Link2 className="h-2.5 w-2.5" />
                                  <span>Mesmo Endereço {del.linkedOrderNumber ? `(#${del.linkedOrderNumber})` : ''}</span>
                                </span>
                              )}

                              {/* Badge Valor Adicional com Motivo */}
                              {hasAdditional && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                  <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                                  <span>
                                    + R$ {Number(del.additionalValue).toFixed(2)}
                                    {del.additionalReason ? ` (${del.additionalReason})` : ''}
                                  </span>
                                </span>
                              )}

                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                del.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                del.status === 'pending' ? 'bg-amber-100 text-amber-800 font-black animate-pulse' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {del.status === 'active' ? 'Aprovada' : del.status === 'pending' ? 'Pendente' : 'Rejeitada'}
                              </span>
                            </div>
                            <p className="text-slate-400">
                              Data: {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2 flex-wrap flex-shrink-0">
                            {del.status === 'pending' && (
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
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300' 
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                              title="Observações e Instruções da Corrida"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Obs</span>
                              {hasNotes && (
                                <span className="bg-amber-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                  {notesCount}
                                </span>
                              )}
                            </button>

                            <button
                              onClick={() => handleShareTracking(del.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                                copiedId === del.id 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                              }`}
                              title="Copiar Link de Rastreamento em Tempo Real para o Cliente"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <span>{copiedId === del.id ? 'Copiado!' : 'Rastreio'}</span>
                            </button>

                            <button
                              onClick={() => handleEditDelivery(del)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Editar Corrida"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteDelivery(del.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir Corrida"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>

                            <span className={`font-black text-sm ml-1 ${del.status === 'active' ? 'text-emerald-600' : 'text-slate-400 line-through'}`}>
                              R$ {Number(del.value).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* BADGE DE COBRANÇA NA ENTREGA */}
                        {renderPaymentBadge(del)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Central de Rastreamento GPS */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4 sticky top-20">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <MapIcon className="h-5 w-5 text-indigo-600" />
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base">Central de Rastreamento</h3>
                    <p className="text-[11px] text-slate-400">{onlineRidersCount} motoboy(s) online escalado(s) hoje</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRecenterMap}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1"
                    title="Centralizar Motoboys"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                    <span>Centralizar</span>
                  </button>
                  <button
                    onClick={() => setIsMapExpanded(!isMapExpanded)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    title="Expandir Mapa em Tela Cheia"
                  >
                    {isMapExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className={isMapExpanded ? "fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] bg-slate-900 p-3 sm:p-5 flex flex-col space-y-3" : "w-full h-[520px] rounded-2xl border border-slate-200/80 overflow-hidden relative"}>
                {isMapExpanded && (
                  <div className="flex items-center justify-between bg-slate-800 text-white px-4 py-3 rounded-2xl border border-slate-700 flex-shrink-0 shadow-lg z-10">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-600 rounded-xl text-white">
                        <MapIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm sm:text-base">Central de Rastreamento - Tela Cheia</h3>
                        <p className="text-xs text-slate-400">{onlineRidersCount} motoboy(s) online escalado(s) hoje</p>
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
                <div ref={mapContainerRef} className="w-full h-full rounded-2xl overflow-hidden" />
              </div>
            </div>
          </div>
        </main>
      )}

      {/* CONTEÚDO DA ABA 2: PAINEL DE FECHAMENTO FINANCEIRO E PAGAMENTOS */}
      {activeMainTab === 'finance' && (
        <main className="max-w-7xl w-full mx-auto px-4 mt-6 space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            
            {/* Header do Fechamento */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Wallet className="h-6 w-6 text-emerald-600" />
                  <span>Painel de Pagamentos aos Motoboys e Administração</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consulte os valores faturados, adicionais concedidos e os repasses líquidos devidos a cada entregador e ao administrador
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={financeFeatureFilter}
                  onChange={(e) => setFinanceFeatureFilter(e.target.value as any)}
                  className="px-3 py-2 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs font-extrabold focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="all">Todos os Tipos de Corrida</option>
                  <option value="with_additional">✨ Somente COM Adicionais</option>
                  <option value="linked">🔗 Mesmo Endereço (R$ 4,00)</option>
                  <option value="standard">Padrão (Sem Adicional)</option>
                </select>

                <select
                  value={financePaidFilter}
                  onChange={(e) => setFinancePaidFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">Todos os Status</option>
                  <option value="unpaid">A Repassar (Pendentes de Baixa)</option>
                  <option value="paid">Já Pagos (Baixados)</option>
                </select>
              </div>
            </div>

            {/* SELEÇÃO DO PERÍODO FINANCEIRO */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <span className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5 tracking-wider">
                  <Filter className="h-4 w-4 text-emerald-600" />
                  <span>Período Selecionado: {financeBounds.label}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setFinancePeriodMode('this_week')}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                    financePeriodMode === 'this_week' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  📅 Esta Semana
                </button>

                <button
                  type="button"
                  onClick={() => setFinancePeriodMode('last_week')}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                    financePeriodMode === 'last_week' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ⏮️ Semana Passada
                </button>

                <button
                  type="button"
                  onClick={() => setFinancePeriodMode('today')}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                    financePeriodMode === 'today' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ⚡ Hoje (Turno Atual)
                </button>

                <button
                  type="button"
                  onClick={() => setFinancePeriodMode('this_month')}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                    financePeriodMode === 'this_month' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  📆 Este Mês
                </button>

                <button
                  type="button"
                  onClick={() => setFinancePeriodMode('custom')}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                    financePeriodMode === 'custom' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
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
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Final</label>
                    <input
                      type="date"
                      value={financeCustomTo}
                      onChange={(e) => setFinanceCustomTo(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CARDS DE RESUMO FINANCEIRO CONSOLIDADO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Total Bruto Cobrado */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-wider">Total Bruto das Entregas</span>
                  <Receipt className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                  R$ {totalFinanceGrossCharged.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  {totalFinanceDeliveriesCount} corrida(s) no período
                </p>
              </div>

              {/* Card 2: Repasse Líquido aos Motoboys */}
              <div className="bg-emerald-50 border-2 border-emerald-300 p-5 rounded-2xl shadow-sm space-y-1">
                <div className="flex items-center justify-between text-emerald-800">
                  <span className="text-[10px] font-black uppercase tracking-wider">Repasse aos Motoboys</span>
                  <Bike className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-700 mt-1">
                  R$ {totalFinanceRidersNet.toFixed(2)}
                </p>
                <p className="text-[11px] text-emerald-800 font-bold">
                  R$ 7,00/corrida padrão + adicionais
                </p>
              </div>

              {/* Card 3: Taxa de Administração (Devida ao Admin) */}
              <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl shadow-sm space-y-1">
                <div className="flex items-center justify-between text-amber-900">
                  <span className="text-[10px] font-black uppercase tracking-wider">Taxa Adm / Sistema</span>
                  <Coins className="h-4 w-4 text-amber-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-amber-800 mt-1">
                  R$ {totalFinanceAdminCut.toFixed(2)}
                </p>
                <p className="text-[11px] text-amber-800 font-bold">
                  R$ 1,00 por corrida padrão
                </p>
              </div>

              {/* Card 4: Total de Adicionais Concedidos */}
              <div className="bg-purple-50 border-2 border-purple-300 p-5 rounded-2xl shadow-sm space-y-1">
                <div className="flex items-center justify-between text-purple-900">
                  <span className="text-[10px] font-black uppercase tracking-wider">Total em Adicionais</span>
                  <Sparkles className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-black tracking-tight text-purple-800 mt-1">
                  R$ {totalFinanceAdditionals.toFixed(2)}
                </p>
                <p className="text-[11px] text-purple-700 font-bold">
                  Bairros distantes / taxas extras
                </p>
              </div>

            </div>

            {/* SEÇÃO: EXTRATO INDIVIDUAL POR MOTOBOY */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <Bike className="h-5 w-5 text-indigo-600" />
                  <span>Repasse Individual por Motoboy ({ridersWithDeliveries.length})</span>
                </h3>

                <div className="w-full sm:w-64 relative">
                  <input
                    type="text"
                    placeholder="Buscar motoboy por nome..."
                    value={financeSearchRider}
                    onChange={(e) => setFinanceSearchRider(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
                </div>
              </div>

              {ridersWithDeliveries.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs">
                  Nenhum motoboy com corridas registradas no período selecionado.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ridersWithDeliveries.map(rider => {
                    const riderDeliveries = financeFilteredDeliveries.filter(d => db.isSameUser(d.riderId, rider.id));
                    const count = riderDeliveries.length;
                    const grossVal = riderDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
                    const adminCut = riderDeliveries.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
                    const riderNet = Math.max(0, grossVal - adminCut);
                    const addsTotal = riderDeliveries.reduce((sum, d) => sum + Number(d.additionalValue || 0), 0);
                    const allPaid = count > 0 && riderDeliveries.every(d => d.paid);

                    return (
                      <div 
                        key={rider.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          count > 0 
                            ? allPaid 
                              ? 'bg-slate-50 border-slate-200' 
                              : 'bg-white border-emerald-300 shadow-sm hover:border-emerald-500' 
                            : 'bg-slate-50/50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center flex-shrink-0">
                              {rider.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-slate-900 text-base truncate">{rider.name}</h4>
                              <p className="text-xs text-slate-500 font-mono">{rider.phone || 'Sem telefone'}</p>
                            </div>
                          </div>

                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                            count === 0 ? 'bg-slate-100 text-slate-500' :
                            allPaid ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {count === 0 ? 'Sem Corridas' : allPaid ? 'Pago / Baixado' : 'A Repassar'}
                          </span>
                        </div>

                        {/* Detalhamento dos Valores do Motoboy */}
                        <div className="grid grid-cols-4 gap-2 pt-3.5 pb-2 text-center border-t border-slate-100 mt-3">
                          <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                            <p className="text-[8px] font-extrabold text-slate-400 uppercase">Corridas</p>
                            <p className="text-sm font-black text-slate-800 mt-0.5">{count}</p>
                          </div>
                          <div className="bg-purple-50/70 rounded-xl p-2 border border-purple-200">
                            <p className="text-[8px] font-extrabold text-purple-800 uppercase">+ Adicionais</p>
                            <p className="text-sm font-black text-purple-700 mt-0.5">R$ {addsTotal.toFixed(2)}</p>
                          </div>
                          <div className="bg-amber-50/60 rounded-xl p-2 border border-amber-200">
                            <p className="text-[8px] font-extrabold text-amber-800 uppercase">Taxa Adm (R$1)</p>
                            <p className="text-sm font-black text-amber-700 mt-0.5">R$ {adminCut.toFixed(2)}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-2 border-2 border-emerald-300">
                            <p className="text-[8px] font-extrabold text-emerald-800 uppercase">Líquido Motoboy</p>
                            <p className="text-sm font-black text-emerald-700 mt-0.5">R$ {riderNet.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">
                            Bruto Total: <strong className="text-slate-800 font-bold">R$ {grossVal.toFixed(2)}</strong>
                          </span>

                          {count > 0 && (
                            <div className="flex items-center space-x-1.5">
                              {allPaid ? (
                                <button
                                  onClick={() => handleUnsettleRiderInEst(rider.id, riderDeliveries.map(d => d.id))}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                                  title="Reverter e marcar como pendente"
                                >
                                  Reverter Baixa
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSettleRiderInEst(rider.id, riderDeliveries.map(d => d.id))}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all shadow-sm flex items-center gap-1"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Dar Baixa (Pagar)</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SEÇÃO: DETALHAMENTO DE TODAS AS CORRIDAS DO FECHAMENTO */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-indigo-600" />
                  <span>Extrato de Corridas do Período ({financeFilteredDeliveries.length})</span>
                </h4>
              </div>

              {financeFilteredDeliveries.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Nenhuma corrida aprovada neste período.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {financeFilteredDeliveries.map(del => {
                    const rider = db.resolveUser(del.riderId);
                    const isSame = del.deliveryType === 'same_address';
                    const hasAdd = Number(del.additionalValue || 0) > 0;
                    const riderNetVal = getRiderNetForDelivery(del);
                    const adminFee = getAdminFeeForDelivery(del);

                    return (
                      <div key={del.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {del.orderNumber && (
                              <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                                #{del.orderNumber}
                              </span>
                            )}
                            <p className="font-extrabold text-slate-800 text-xs">{rider?.name || 'Motoboy'}</p>

                            {isSame && (
                              <span className="bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                <Link2 className="h-2.5 w-2.5" />
                                <span>Mesmo Endereço {del.linkedOrderNumber ? `(#${del.linkedOrderNumber})` : ''}</span>
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

                        <div className="flex items-center gap-4 justify-between sm:justify-end">
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold">
                              Bruto: R$ {Number(del.value).toFixed(2)} {adminFee > 0 ? `(- R$ ${adminFee.toFixed(2)} adm)` : ''}
                            </p>
                            <p className="text-xs font-black text-emerald-600">
                              Líquido Motoboy: R$ {riderNetVal.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </main>
      )}

      <DeliveryModal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        editingDelivery={editingDelivery}
        riders={allRiders}
        establishments={currentEst ? [currentEst] : []}
        deliveryForm={deliveryForm}
        setDeliveryForm={setDeliveryForm}
        onSave={handleSaveDelivery}
        isSubmitting={isSubmittingDelivery}
      />

      <BatchDeliveryModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        riders={allRiders}
        establishments={currentEst ? [currentEst] : []}
        defaultEstablishmentId={currentEst?.id}
        onSaved={loadData}
      />

      <DeliveryNotesModal
        isOpen={!!notesDeliveryId}
        onClose={() => setNotesDeliveryId(null)}
        delivery={activeNotesDelivery}
        userRole="establishment"
        userName={currentEst?.name || user?.name || 'Gerente'}
        onSaveNotes={handleSaveNotes}
      />

      <ScheduleChatModal
        isOpen={!!activeScheduleChatId}
        onClose={() => setActiveScheduleChatId(null)}
        schedule={activeScheduleChat}
        userRole="establishment"
        userName={currentEst?.name || user?.name || 'Gerente'}
        onSaveChat={handleSaveScheduleChat}
      />
    </div>
  );
}