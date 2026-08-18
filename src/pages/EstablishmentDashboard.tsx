"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Delivery, User, Schedule, RiderLocation, Establishment, getDeliveryOperationalDate, isSameDayString } from '../utils/db';
import { 
  LogOut, 
  Check, 
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
  Link2
} from 'lucide-react';
import L from 'leaflet';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import DeliveryModal from '../components/DeliveryModal';
import BatchDeliveryModal from '../components/BatchDeliveryModal';
import { realtimeGps } from '../utils/realtimeGps';

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

export default function EstablishmentDashboard() {
  const navigate = useNavigate();
  const [user] = useState(db.getCurrentUser());

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [allRiders, setAllRiders] = useState<User[]>([]);
  const [establishmentSchedules, setEstablishmentSchedules] = useState<Schedule[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [currentEst, setCurrentEst] = useState<Establishment | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtros de corridas
  const [filterMode, setFilterMode] = useState<'smart_shift' | 'date_range' | 'all'>('smart_shift');
  const [smartDate, setSmartDate] = useState<string>(db.getOperationalDateString());
  const [smartPeriod, setSmartPeriod] = useState<'all_shifts' | 'night_shift' | 'morning_shift' | 'afternoon_shift'>('all_shifts');

  const [riderFilter, setRiderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [orderNumberFilter, setOrderNumberFilter] = useState<string>('');
  const [notesFilter, setNotesFilter] = useState<'all' | 'with_notes' | 'without_notes'>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'highest_value'>('recent');

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
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
    linkedOrderNumber: ''
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
  }, [isMapExpanded]);

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
    const updated = allDeliveries.map(d => d.id === id ? { ...d, status: 'active' as const, updatedAt: new Date().toISOString() } : d);
    await db.setDeliveries(updated);
    loadData();
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
      linkedOrderNumber: ''
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
      linkedOrderNumber: del.linkedOrderNumber || ''
    });
    setShowDeliveryModal(true);
  };

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEst) return;

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
        alert(`⚠️ Erro: O pedido #${cleanOrderNumber} já foi lançado hoje por ${dupCheck.riderName}.\n\nNão é permitido lançar mais de uma corrida com o mesmo número de pedido.`);
        return;
      }
    }

    const allDeliveries = db.getDeliveries();
    const nowStr = new Date().toISOString();

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
        linkedOrderNumber: deliveryForm.deliveryType === 'same_address' ? (deliveryForm.linkedOrderNumber?.trim().replace('#', '') || undefined) : undefined,
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
        linkedOrderNumber: deliveryForm.deliveryType === 'same_address' ? (deliveryForm.linkedOrderNumber?.trim().replace('#', '') || undefined) : undefined,
        updatedAt: nowStr,
        paid: false
      };
      await db.setDeliveries([...allDeliveries, newDelivery]);
    }

    setShowDeliveryModal(false);
    setEditingDelivery(null);
    loadData();
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

  const filteredDeliveries = deliveries
    .filter(d => {
      const hasNotes = Boolean(d.notes && d.notes.trim().length > 0);
      if (notesFilter === 'with_notes' && !hasNotes) return false;
      if (notesFilter === 'without_notes' && hasNotes) return false;

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

  const activeNotesDelivery = db.getDeliveries().find(d => d.id === notesDeliveryId) || null;
  const activeScheduleChat = db.getSchedules().find(s => s.id === activeScheduleChatId) || null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-12">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Bike className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-extrabold leading-tight text-white">{currentEst?.name || 'Estabelecimento'}</h1>
              <p className="text-[11px] text-slate-400 font-medium">Gestão e Rastreamento em Tempo Real</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
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

      <main className="max-w-7xl w-full mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
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

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-base">
                  Motoboys Escalados Hoje ({todaySchedules.length})
                </h3>
              </div>

              <div className="flex items-center space-x-2">
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

              <button
                onClick={() => setShowBatchModal(true)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 self-start sm:self-center"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Lançar em Lote</span>
              </button>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 border-t border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1 flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    <span>Nº da Corrida / Pedido</span>
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
                    <div key={del.id} className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${isSame ? 'bg-purple-50/30 p-2 rounded-xl border border-purple-100' : ''}`}>
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

                          {/* Badge Valor Adicional */}
                          {hasAdditional && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                              <span>+ R$ {Number(del.additionalValue).toFixed(2)}</span>
                            </span>
                          )}

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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

      <DeliveryModal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        editingDelivery={editingDelivery}
        riders={allRiders}
        establishments={currentEst ? [currentEst] : []}
        deliveryForm={deliveryForm}
        setDeliveryForm={setDeliveryForm}
        onSave={handleSaveDelivery}
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