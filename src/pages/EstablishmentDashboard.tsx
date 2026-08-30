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
  Search,
  CheckCircle2,
  Clock,
  TrendingUp,
  X,
  Phone,
  ArrowUpDown,
  Copy
} from 'lucide-react';
import L from 'leaflet';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import DeliveryModal from '../components/DeliveryModal';
import BatchDeliveryModal from '../components/BatchDeliveryModal';
import RiderFinancialMetricsCard from '../components/RiderFinancialMetricsCard';
import { realtimeGps } from '../utils/realtimeGps';

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

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

export function getShiftLabel(shift: string): string {
  switch(shift) {
    case 'morning': return 'Manhã';
    case 'afternoon': return 'Tarde';
    case 'night': return 'Noite';
    default: return shift || '';
  }
}

export default function EstablishmentDashboard() {
  const navigate = useNavigate();
  const [user] = useState(db.getCurrentUser());

  // Aba ativa: Operação diária, Repasses individuais, Histórico de Corridas
  const [activeTab, setActiveTab] = useState<'operation' | 'settlements' | 'deliveries_history'>('operation');

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [allRiders, setAllRiders] = useState<User[]>([]);
  const [establishmentSchedules, setEstablishmentSchedules] = useState<Schedule[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [currentEst, setCurrentEst] = useState<Establishment | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- FILTROS DA ABA DE REPASSES INDIVIDUAIS DOS MOTOBOYS ---
  const [settlePeriodMode, setSettlePeriodMode] = useState<'this_week' | 'last_week' | 'today' | 'this_month' | 'custom'>('this_week');
  const [settleCustomFrom, setSettleCustomFrom] = useState<string>('');
  const [settleCustomTo, setSettleCustomTo] = useState<string>('');
  const [settleRiderSearch, setSettleRiderSearch] = useState<string>('');
  const [settlePaidFilter, setSettlePaidFilter] = useState<'unpaid' | 'paid' | 'all'>('all');
  const [settleFeatureFilter, setSettleFeatureFilter] = useState<'all' | 'same_order_number' | 'with_additional' | 'linked' | 'standard'>('all');
  const [settlePaymentFilter, setSettlePaymentFilter] = useState<'all' | 'to_collect' | 'money' | 'card' | 'pix' | 'already_paid'>('all');
  const [selectedRiderDetailsId, setSelectedRiderDetailsId] = useState<string | null>(null);

  // --- FILTROS DE HISTÓRICO DE CORRIDAS ---
  const [filterMode, setFilterMode] = useState<'smart_shift' | 'date_range' | 'all'>('smart_shift');
  const [smartDate, setSmartDate] = useState<string>(db.getOperationalDateString());
  const [smartPeriod, setSmartPeriod] = useState<'all_shifts' | 'night_shift' | 'morning_shift' | 'afternoon_shift'>('all_shifts');

  const [riderFilter, setRiderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [featureFilter, setFeatureFilter] = useState<'all' | 'same_order_number' | 'with_additional' | 'linked' | 'standard'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'to_collect' | 'money' | 'card' | 'pix' | 'already_paid'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [orderNumberFilter, setOrderNumberFilter] = useState<string>('');
  const [notesFilter, setNotesFilter] = useState<'all' | 'with_notes' | 'without_notes'>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'order_number_grouped' | 'highest_value'>('recent');

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

    loadData();
    const interval = setInterval(() => {
      db.pullFromSupabase().then(() => loadData());
    }, 2000);

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
  }, [onlineScheduledRiderLocations, activeTab]);

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [isMapExpanded, activeTab]);

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
    const isSame = del.deliveryType === 'same_address' || Number(del.value) === 4 || Boolean(del.linkedOrderNumber);

    setDeliveryForm({
      riderId: del.riderId,
      establishmentId: del.establishmentId,
      date: del.date,
      time: del.time,
      value: isSame ? '4.00' : '8.00',
      orderNumber: del.orderNumber || '',
      notes: del.notes || '',
      deliveryType: isSame ? 'same_address' : 'standard',
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

      const isSame = deliveryForm.deliveryType === 'same_address' || Number(finalVal) === 4 || Boolean(deliveryForm.linkedOrderNumber);

      if (editingDelivery) {
        const updated = allDeliveries.map(d => d.id === editingDelivery.id ? {
          ...d,
          riderId: deliveryForm.riderId,
          date: deliveryForm.date,
          time: deliveryForm.time,
          value: finalVal,
          orderNumber: cleanOrderNumber || undefined,
          notes: deliveryForm.notes.trim() || undefined,
          deliveryType: isSame ? ('same_address' as const) : ('standard' as const),
          additionalValue: addVal > 0 ? addVal : undefined,
          additionalReason: deliveryForm.additionalReason?.trim() || undefined,
          linkedOrderNumber: isSame ? (deliveryForm.linkedOrderNumber?.trim().replace('#', '') || undefined) : undefined,
          paymentMethod: deliveryForm.paymentMethod || 'already_paid',
          orderCollectionAmount: collectionAmount,
          changeFor: changeForValue,
          updatedAt: nowStr
        } : d);
        await db.setDeliveries(updated);
      } else {
        const newDelivery: Delivery = {
          id: 'd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          riderId: deliveryForm.riderId,
          establishmentId: currentEst.id,
          date: deliveryForm.date,
          time: deliveryForm.time,
          value: finalVal,
          status: 'active',
          orderNumber: cleanOrderNumber || undefined,
          notes: deliveryForm.notes.trim() || undefined,
          deliveryType: isSame ? ('same_address' as const) : ('standard' as const),
          additionalValue: addVal > 0 ? addVal : undefined,
          additionalReason: deliveryForm.additionalReason?.trim() || undefined,
          linkedOrderNumber: isSame ? (deliveryForm.linkedOrderNumber?.trim().replace('#', '') || undefined) : undefined,
          paymentMethod: deliveryForm.paymentMethod || 'already_paid',
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

  // --- REPASSE / BAIXA DO MOTOBOY ---
  const handleSettleRiderDeliveries = async (riderId: string, deliveryIds: string[]) => {
    const rider = db.resolveUser(riderId);
    if (!rider) return;

    if (confirm(`Deseja dar baixa e marcar as ${deliveryIds.length} corrida(s) de ${rider.name} como PAGAS?`)) {
      const allDeliveries = db.getDeliveries();
      const idSet = new Set(deliveryIds);
      const updated = allDeliveries.map(d => idSet.has(d.id) ? { ...d, paid: true, updatedAt: new Date().toISOString() } : d);
      await db.setDeliveries(updated);
      loadData();
    }
  };

  const handleUnsettleRiderDeliveries = async (riderId: string, deliveryIds: string[]) => {
    const rider = db.resolveUser(riderId);
    if (!rider) return;

    if (confirm(`Deseja reverter e marcar as ${deliveryIds.length} corrida(s) de ${rider.name} como A REPASSAR (PENDENTES)?`)) {
      const allDeliveries = db.getDeliveries();
      const idSet = new Set(deliveryIds);
      const updated = allDeliveries.map(d => idSet.has(d.id) ? { ...d, paid: false, updatedAt: new Date().toISOString() } : d);
      await db.setDeliveries(updated);
      loadData();
    }
  };

  // --- CÁLCULO DE LIMITES DE DATA DA ABA DE REPASSES ---
  const getSettleDateBounds = (): { start: string; end: string; label: string } => {
    const now = new Date();
    if (settlePeriodMode === 'today') {
      const tStr = db.getOperationalDateString();
      return { start: tStr, end: tStr, label: 'Hoje (Turno Atual)' };
    }

    if (settlePeriodMode === 'this_week') {
      const monStr = getThisMonday();
      const [y, m, d] = monStr.split('-').map(Number);
      const sun = new Date(y, m - 1, d + 6);
      const sunStr = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
      return { start: monStr, end: sunStr, label: 'Esta Semana (Segunda a Domingo)' };
    }

    if (settlePeriodMode === 'last_week') {
      const monStr = getThisMonday();
      const [y, m, d] = monStr.split('-').map(Number);
      const lastMon = new Date(y, m - 1, d - 7);
      const lastSun = new Date(y, m - 1, d - 1);
      const lastMonStr = `${lastMon.getFullYear()}-${String(lastMon.getMonth() + 1).padStart(2, '0')}-${String(lastSun.getDate()).padStart(2, '0')}`;
      const lastSunStr = `${lastSun.getFullYear()}-${String(lastSun.getMonth() + 1).padStart(2, '0')}-${String(lastSun.getDate()).padStart(2, '0')}`;
      return { start: lastMonStr, end: lastSunStr, label: 'Semana Passada' };
    }

    if (settlePeriodMode === 'this_month') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start: startStr, end: endStr, label: 'Este Mês' };
    }

    return {
      start: settleCustomFrom || '1970-01-01',
      end: settleCustomTo || '2099-12-31',
      label: 'Período Personalizado'
    };
  };

  const settleBounds = getSettleDateBounds();

  // Filtragem de corridas para a aba de repasses
  const filteredSettleDeliveries = deliveries.filter(d => {
    if (d.status !== 'active') return false;

    if (d.date < settleBounds.start || d.date > settleBounds.end) return false;

    if (settlePaidFilter === 'unpaid' && d.paid) return false;
    if (settlePaidFilter === 'paid' && !d.paid) return false;

    if (settleFeatureFilter === 'same_order_number') {
      const repeats = getOrderRepeatCount(d);
      if (repeats <= 1) return false;
    } else if (settleFeatureFilter === 'with_additional' && (!d.additionalValue || Number(d.additionalValue) <= 0)) {
      return false;
    } else if (settleFeatureFilter === 'linked' && (d.deliveryType !== 'same_address' && !d.linkedOrderNumber && Number(d.value) !== 4)) {
      return false;
    } else if (settleFeatureFilter === 'standard' && (d.deliveryType === 'same_address' || Boolean(d.linkedOrderNumber) || Number(d.value) === 4 || (d.additionalValue && Number(d.additionalValue) > 0))) {
      return false;
    }

    if (settlePaymentFilter === 'to_collect' && (!d.paymentMethod || d.paymentMethod === 'already_paid')) return false;
    if (settlePaymentFilter === 'money' && d.paymentMethod !== 'money') return false;
    if (settlePaymentFilter === 'card' && d.paymentMethod !== 'card_debit' && d.paymentMethod !== 'card_credit') return false;
    if (settlePaymentFilter === 'pix' && d.paymentMethod !== 'pix_delivery') return false;
    if (settlePaymentFilter === 'already_paid' && d.paymentMethod && d.paymentMethod !== 'already_paid') return false;

    return true;
  });

  // Lista de motoboys que possuem corridas ou escalas no estabelecimento
  const relevantRiders = allRiders.filter(r => {
    const hasSchedules = establishmentSchedules.some(s => db.isSameUser(s.riderId, r.id));
    const hasDeliveries = deliveries.some(d => db.isSameUser(d.riderId, r.id));
    return hasSchedules || hasDeliveries;
  }).filter(r => 
    r.name.toLowerCase().includes(settleRiderSearch.toLowerCase()) || 
    r.phone.includes(settleRiderSearch)
  );

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

      const isSame = d.deliveryType === 'same_address' || Number(d.value) === 4 || Boolean(d.linkedOrderNumber);

      if (featureFilter === 'same_order_number') {
        const repeats = getOrderRepeatCount(d);
        if (repeats <= 1) return false;
      } else if (featureFilter === 'with_additional') {
        const hasAdd = Number(d.additionalValue || 0) > 0;
        if (!hasAdd) return false;
      } else if (featureFilter === 'linked') {
        if (!isSame) return false;
      } else if (featureFilter === 'standard') {
        if (isSame || (d.additionalValue && Number(d.additionalValue) > 0)) return false;
      }

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

      if (riderFilter !== 'all' && !db.isSameUser(d.riderId, riderFilter)) return false;
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
      if (sortOrder === 'order_number_grouped') {
        const numA = parseInt((a.orderNumber || '0').replace(/\D/g, '') || '0', 10);
        const numB = parseInt((b.orderNumber || '0').replace(/\D/g, '') || '0', 10);
        if (numA !== numB) return numB - numA;
        return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
      }
      if (sortOrder === 'recent') return b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.id.localeCompare(a.id);
      if (sortOrder === 'oldest') return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id);
      if (sortOrder === 'highest_value') return Number(b.value || 0) - Number(a.value || 0);
      return 0;
    });

  const activeNotesDelivery = db.getDeliveries().find(d => d.id === notesDeliveryId) || null;
  const activeScheduleChat = db.getSchedules().find(s => s.id === activeScheduleChatId) || null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-12">
      
      {/* Header Principal */}
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
              onClick={() => handleOpenLaunchModal()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
              title="Lançar corrida individual"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lançar Corrida</span>
            </button>
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

      {/* BARRA DE NAVEGAÇÃO DE ABAS DO ESTABELECIMENTO */}
      <div className="bg-white border-b border-slate-200 sticky top-[57px] z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('operation')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 flex-shrink-0 ${
              activeTab === 'operation'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Operação & Rastreamento</span>
          </button>

          <button
            onClick={() => setActiveTab('settlements')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 flex-shrink-0 ${
              activeTab === 'settlements'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200'
            }`}
          >
            <Wallet className="h-4 w-4 text-emerald-500" />
            <span>Repasses dos Motoboys (Fechamento)</span>
          </button>

          <button
            onClick={() => setActiveTab('deliveries_history')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 flex-shrink-0 ${
              activeTab === 'deliveries_history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Check className="h-4 w-4" />
            <span>Todas as Corridas ({deliveries.length})</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl w-full mx-auto px-4 mt-6 flex-1">
        
        {/* ABA 1: OPERAÇÃO DO DIA + CARDS DOS MOTOBOYS ESCALADOS + RASTREAMENTO */}
        {activeTab === 'operation' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              
              {/* Métricas do Dia */}
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

              {/* CARDS DOS MOTOBOYS ESCALADOS HOJE */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base">
                        Motoboys Escalados Hoje ({todaySchedules.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Lance corridas rapidamente e consulte o status em tempo real
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenLaunchModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Lançar Corrida</span>
                  </button>
                </div>

                {todaySchedules.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400 space-y-1">
                    <Users className="h-8 w-8 mx-auto text-slate-300 mb-1" />
                    <p className="font-bold text-slate-600 text-sm">Nenhum motoboy escalado para hoje</p>
                    <p className="text-slate-400 text-xs">Solicite ao Administrador o agendamento de escalas para seu estabelecimento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {todaySchedules.map((sch) => {
                      const rider = db.resolveUser(sch.riderId);
                      const isOnline = onlineScheduledRiderLocations.some(l => l.riderId === sch.riderId);

                      return (
                        <div key={sch.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3.5 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between">
                          
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3 min-w-0">
                                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black text-base flex items-center justify-center flex-shrink-0 shadow-sm">
                                  {rider?.name ? rider.name.charAt(0).toUpperCase() : 'M'}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-extrabold text-slate-900 text-sm truncate">{rider?.name || 'Motoboy'}</h4>
                                  <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                    <Phone className="h-3 w-3 text-slate-400" />
                                    <span>{rider?.phone || 'Sem telefone'}</span>
                                  </p>
                                </div>
                              </div>

                              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1 ${
                                isOnline 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse' 
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                {isOnline ? 'ONLINE' : 'OFFLINE'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-600 mt-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                              <Clock className="h-4 w-4 text-indigo-600" />
                              <span className="font-extrabold text-slate-800">Turno da {getShiftLabel(sch.shift)}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-slate-500 font-semibold">{sch.startTime} - {sch.endTime}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleOpenLaunchModal(sch.riderId)}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Lançar Corrida</span>
                            </button>

                            <button
                              onClick={() => setActiveScheduleChatId(sch.id)}
                              className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                              title="Chat do Turno com o Motoboy"
                            >
                              <MessageSquare className="h-4 w-4 text-indigo-600" />
                              <span>Chat</span>
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Corridas de Hoje */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-indigo-600" />
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base">
                        Corridas de Hoje ({todayDeliveries.length})
                      </h3>
                      <p className="text-xs text-slate-400">Entregas despachadas no turno atual</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenLaunchModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Lançar Corrida</span>
                  </button>
                </div>

                {todayDeliveries.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">
                    Nenhuma corrida lançada hoje até o momento.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {todayDeliveries.map(del => {
                      const rider = db.resolveUser(del.riderId);
                      const isSame = del.deliveryType === 'same_address' || Number(del.value) === 4 || Boolean(del.linkedOrderNumber);
                      const hasAdd = Number(del.additionalValue || 0) > 0;
                      const repeatCount = getOrderRepeatCount(del);

                      return (
                        <div key={del.id} className={`py-3 flex flex-col space-y-1 text-xs ${repeatCount > 1 ? 'bg-amber-50/30 p-2.5 rounded-xl border border-amber-200' : ''}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {del.orderNumber && (
                                  <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                                    #{del.orderNumber}
                                  </span>
                                )}
                                <p className="font-extrabold text-slate-800 text-xs">{rider?.name || 'Motoboy'}</p>

                                {repeatCount > 1 && (
                                  <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs border border-amber-600 animate-pulse">
                                    <Copy className="h-2.5 w-2.5" />
                                    <span>Nº Repetido ({repeatCount}x)</span>
                                  </span>
                                )}
                                
                                {isSame && (
                                  <span className="bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Link2 className="h-2.5 w-2.5" />
                                    <span>Mesmo {del.linkedOrderNumber ? `(#${del.linkedOrderNumber})` : '(R$4)'}</span>
                                  </span>
                                )}

                                {hasAdd && (
                                  <span className="bg-amber-100 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                    + R$ {Number(del.additionalValue).toFixed(2)}
                                  </span>
                                )}

                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                  del.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                  del.status === 'pending' ? 'bg-amber-100 text-amber-800 font-black animate-pulse' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {del.status === 'active' ? 'Aprovada' : del.status === 'pending' ? 'Pendente' : 'Rejeitada'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">{del.time}</p>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {del.status === 'pending' && (
                                <button
                                  onClick={() => handleApproveDelivery(del.id)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                                >
                                  Aprovar
                                </button>
                              )}
                              <button
                                onClick={() => handleShareTracking(del.id)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-bold flex items-center gap-1"
                              >
                                <Share2 className="h-3 w-3" />
                                <span>{copiedId === del.id ? 'Copiado!' : 'Rastreio'}</span>
                              </button>
                              <span className="font-black text-xs text-emerald-700 ml-1">
                                R$ {Number(del.value).toFixed(2)}
                              </span>
                            </div>
                          </div>

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

                <div className={isMapExpanded ? "fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] bg-slate-900 p-3 sm:p-5 flex flex-col space-y-3" : "w-full h-[480px] rounded-2xl border border-slate-200/80 overflow-hidden relative"}>
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
          </div>
        )}

        {/* ABA 2: REPASSES INDIVIDUAIS DOS MOTOBOYS (FECHAMENTO COM 5 MÉTRICAS) */}
        {activeTab === 'settlements' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 space-y-6 animate-fadeIn">
            
            {/* Header da Aba de Repasses */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Wallet className="h-6 w-6 text-emerald-600" />
                  <span>Repasses Individuais dos Motoboys</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fechamento financeiro com 5 métricas: Corridas, Mesmo Endereço (R$4 isento), Adicionais, Taxa Adm (R$1) e Líquido
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={settleFeatureFilter}
                  onChange={(e) => setSettleFeatureFilter(e.target.value as any)}
                  className="px-3 py-1.5 border border-purple-300 rounded-xl text-xs font-bold text-purple-900 bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="all">Todos os Tipos</option>
                  <option value="same_order_number">👯‍♂️ Pedidos com Mesmo Nº (Repetidos)</option>
                  <option value="with_additional">✨ Com Adicional</option>
                  <option value="linked">🔗 Vinculadas (Mesmo End.)</option>
                  <option value="standard">Padrão</option>
                </select>

                <select
                  value={settlePaidFilter}
                  onChange={(e) => setSettlePaidFilter(e.target.value as any)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">Todas as Corridas</option>
                  <option value="unpaid">A Repassar (Pendentes de Baixa)</option>
                  <option value="paid">Já Pagas (Baixadas)</option>
                </select>
              </div>
            </div>

            {/* PAINEL DE FILTROS AVANÇADOS */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                <span className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5 tracking-wider">
                  <Filter className="h-4 w-4 text-emerald-600" />
                  <span>Período Selecionado: {settleBounds.label}</span>
                </span>

                {/* Campo de Busca por Nome de Motoboy */}
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="Buscar motoboy por nome ou telefone..."
                    value={settleRiderSearch}
                    onChange={(e) => setSettleRiderSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
                  />
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  {settleRiderSearch && (
                    <button onClick={() => setSettleRiderSearch('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Botões de Período Rápido */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setSettlePeriodMode('this_week')}
                  className={`py-2 rounded-xl text-xs font-black transition-all border ${
                    settlePeriodMode === 'this_week' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  📅 Esta Semana
                </button>

                <button
                  type="button"
                  onClick={() => setSettlePeriodMode('last_week')}
                  className={`py-2 rounded-xl text-xs font-black transition-all border ${
                    settlePeriodMode === 'last_week' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ⏮️ Semana Passada
                </button>

                <button
                  type="button"
                  onClick={() => setSettlePeriodMode('today')}
                  className={`py-2 rounded-xl text-xs font-black transition-all border ${
                    settlePeriodMode === 'today' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ⚡ Hoje (Turno)
                </button>

                <button
                  type="button"
                  onClick={() => setSettlePeriodMode('this_month')}
                  className={`py-2 rounded-xl text-xs font-black transition-all border ${
                    settlePeriodMode === 'this_month' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  📆 Este Mês
                </button>

                <button
                  type="button"
                  onClick={() => setSettlePeriodMode('custom')}
                  className={`py-2 rounded-xl text-xs font-black transition-all border ${
                    settlePeriodMode === 'custom' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  🔍 Personalizado
                </button>
              </div>

              {/* Seletor de Datas Personalizado */}
              {settlePeriodMode === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Inicial</label>
                    <input
                      type="date"
                      value={settleCustomFrom}
                      onChange={(e) => setSettleCustomFrom(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Final</label>
                    <input
                      type="date"
                      value={settleCustomTo}
                      onChange={(e) => setSettleCustomTo(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CARDS COM AS 5 MÉTRICAS DE CADA MOTOBOY */}
            {relevantRiders.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs">
                Nenhum motoboy encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {relevantRiders.map(rider => {
                  const riderDeliveries = filteredSettleDeliveries.filter(d => db.isSameUser(d.riderId, rider.id));
                  const count = riderDeliveries.length;
                  const allPaid = count > 0 && riderDeliveries.every(d => d.paid);

                  return (
                    <div key={rider.id} className="space-y-2">
                      <RiderFinancialMetricsCard
                        riderName={rider.name}
                        riderPhone={rider.phone}
                        deliveries={riderDeliveries}
                        isPaid={allPaid}
                        showSettleButton={true}
                        onSettle={() => handleSettleRiderDeliveries(rider.id, riderDeliveries.map(d => d.id))}
                        onUnsettle={() => handleUnsettleRiderDeliveries(rider.id, riderDeliveries.map(d => d.id))}
                        periodLabel={settleBounds.label}
                      />

                      {count > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedRiderDetailsId(selectedRiderDetailsId === rider.id ? null : rider.id)}
                          className="w-full py-1.5 text-center text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/50 hover:bg-indigo-100/60 rounded-xl border border-indigo-100 transition-colors"
                        >
                          {selectedRiderDetailsId === rider.id ? 'Ocultar Detalhes das Corridas ▲' : `Ver ${count} Corrida(s) Detalhada(s) ▼`}
                        </button>
                      )}

                      {/* Tabela detalhada expansível */}
                      {selectedRiderDetailsId === rider.id && count > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 text-xs animate-fadeIn">
                          <p className="font-extrabold text-slate-700 text-[11px] uppercase tracking-wider">
                            Corridas de {rider.name} ({settleBounds.label})
                          </p>
                          <div className="divide-y divide-slate-200/60 max-h-56 overflow-y-auto">
                            {riderDeliveries.map(del => (
                              <div key={del.id} className="py-2 flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    {del.orderNumber && (
                                      <span className="font-black bg-indigo-600 text-white text-[9px] px-1.5 py-0.2 rounded">
                                        #{del.orderNumber}
                                      </span>
                                    )}
                                    <span className="font-mono text-[11px] text-slate-600">{del.time}</span>
                                    <span className="text-[10px] text-slate-400">({new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')})</span>
                                  </div>
                                  {(del.deliveryType === 'same_address' || Number(del.value) === 4 || Boolean(del.linkedOrderNumber)) && (
                                    <span className="text-[9px] font-bold text-purple-700">Mesmo Endereço {del.linkedOrderNumber ? `(#${del.linkedOrderNumber})` : '(R$ 4)'}</span>
                                  )}
                                  {Number(del.additionalValue || 0) > 0 && (
                                    <span className="text-[9px] font-bold text-amber-700">+ Adicional R$ {Number(del.additionalValue).toFixed(2)}</span>
                                  )}
                                </div>
                                <span className="font-black text-slate-800 text-xs">
                                  R$ {Number(del.value).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 3: TODAS AS CORRIDAS E HISTÓRICO COMPLETO */}
        {activeTab === 'deliveries_history' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Check className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    Histórico Completo de Corridas ({filteredDeliveries.length})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Filtre todas as entregas por turno, data, número de pedido ou observações
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleOpenLaunchModal()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Lançar Corrida</span>
                </button>
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
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
                    <span>Tipo / Agrupamento</span>
                  </label>
                  <select
                    value={featureFilter}
                    onChange={(e) => setFeatureFilter(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-purple-300 bg-purple-50/50 rounded-lg text-xs font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="all">Todos os Tipos</option>
                    <option value="same_order_number">👯‍♂️ Pedidos com Mesmo Nº (Repetidos)</option>
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

              <div className="pt-2 border-t border-slate-200/80 flex justify-end">
                <div className="w-full sm:w-72">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3 text-indigo-600" />
                    <span>Classificação</span>
                  </label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700"
                  >
                    <option value="recent">Mais Recentes Primeiro</option>
                    <option value="oldest">Mais Antigas Primeiro</option>
                    <option value="order_number_grouped">👯‍♂️ Agrupar por Nº do Pedido (Mesmo Nº)</option>
                    <option value="highest_value">Maior Valor (R$)</option>
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
                  const isSame = del.deliveryType === 'same_address' || Number(del.value) === 4 || Boolean(del.linkedOrderNumber);
                  const hasAdditional = Number(del.additionalValue || 0) > 0;
                  const repeatCount = getOrderRepeatCount(del);

                  return (
                    <div key={del.id} className={`py-3.5 flex flex-col space-y-1.5 text-xs ${repeatCount > 1 ? 'border-l-4 border-l-amber-500 bg-amber-50/20' : ''} ${isSame ? 'bg-purple-50/30 p-2.5 rounded-xl border border-purple-100' : ''}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            {del.orderNumber && (
                              <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                                #{del.orderNumber}
                              </span>
                            )}
                            <p className="font-extrabold text-slate-800 text-sm truncate">{rider?.name || 'Motoboy'}</p>

                            {repeatCount > 1 && (
                              <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs border border-amber-600 animate-pulse">
                                <Copy className="h-2.5 w-2.5" />
                                <span>Nº Repetido ({repeatCount}x)</span>
                              </span>
                            )}

                            {isSame && (
                              <span className="bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                <Link2 className="h-3 w-3" />
                                <span>Mesmo Endereço {del.linkedOrderNumber ? `(#${del.linkedOrderNumber})` : ''}</span>
                              </span>
                            )}

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

                      {renderPaymentBadge(del)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

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