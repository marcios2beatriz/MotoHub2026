"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Delivery, QueueEntry, User, Schedule, RiderLocation, Establishment } from '../utils/db';
import { 
  LogOut, 
  Check, 
  X, 
  Plus, 
  ListOrdered, 
  Bike, 
  Users,
  DollarSign,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  MessageSquare,
  Trash2,
  Share2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Crown,
  UserPlus,
  LocateFixed,
  AlertTriangle,
  RotateCw,
  Ban,
  Calendar,
  Filter
} from 'lucide-react';
import L from 'leaflet';
import DeliveryNotesModal from '../components/DeliveryNotesModal';
import ScheduleChatModal from '../components/ScheduleChatModal';
import DeliveryModal from '../components/DeliveryModal';
import { realtimeGps } from '../utils/realtimeGps';

export default function EstablishmentDashboard() {
  const navigate = useNavigate();
  const [user] = useState(db.getCurrentUser());

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [allRiders, setAllRiders] = useState<User[]>([]);
  const [establishmentSchedules, setEstablishmentSchedules] = useState<Schedule[]>([]);
  const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
  const [currentEst, setCurrentEst] = useState<Establishment | null>(null);

  // Estado de link copiado
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtros avançados de corridas e histórico
  const [riderFilter, setRiderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<'today' | '7days' | '30days' | 'all' | 'custom'>('today');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'highest_value'>('recent');

  // Modal para adicionar motoboy na fila manualmente
  const [showAddQueueModal, setShowAddQueueModal] = useState(false);
  const [selectedQueueRiderId, setSelectedQueueRiderId] = useState('');

  // Modais de chat e corrida
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    riderId: '',
    establishmentId: '',
    date: db.getOperationalDateString(),
    time: new Date().toTimeString().slice(0, 5),
    value: '',
    orderNumber: '',
    notes: ''
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

    const estQueue = db.getQueue().filter(q => 
      db.isSameEstablishment(q.establishmentId, estFound!.id) && 
      q.status === 'waiting' &&
      (q.date === todayStr || (q.joinedAt && q.joinedAt.startsWith(todayStr)))
    ).sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

    const riders = db.getUsers().filter(u => u.role === 'rider' && u.active);
    const schedules = db.getSchedules().filter(s => 
      db.isSameEstablishment(s.establishmentId, estFound!.id)
    );
    const locations = db.getRiderLocations();

    setDeliveries([...estDeliveries].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)));
    setQueue(estQueue);
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

    const handleQueueUpdate = () => loadData();
    window.addEventListener('queue-updated', handleQueueUpdate);
    window.addEventListener('db-sync-complete', handleQueueUpdate);

    const unsubscribeOffline = realtimeGps.subscribeToOffline((payload) => {
      if (mapRef.current && markersRef.current[payload.riderId]) {
        mapRef.current.removeLayer(markersRef.current[payload.riderId]);
        delete markersRef.current[payload.riderId];
      }
      loadData();
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('queue-updated', handleQueueUpdate);
      window.removeEventListener('db-sync-complete', handleQueueUpdate);
      unsubscribeOffline();
    };
  }, [user, navigate]);

  const todaySchedulesRaw = establishmentSchedules.filter(s => db.isSameDayString(s.date, todayStr));
  
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

  const handleRecenterMap = () => {
    const currentMap = mapRef.current;
    if (!currentMap) return;
    const points: L.LatLngExpression[] = [];
    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 60 * 1000;

    riderLocations.forEach(loc => {
      const resolved = db.resolveUser(loc.riderId);
      const riderIdToCheck = resolved ? resolved.id : loc.riderId;
      if (!scheduledRiderIds.has(riderIdToCheck)) return;
      
      const lastUpdateMs = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
      if (loc.lat && loc.lng && lastUpdateMs > 0 && Math.abs(now - lastUpdateMs) < ONLINE_THRESHOLD_MS) {
        points.push([loc.lat, loc.lng]);
      }
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
    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 60 * 1000;
    const points: L.LatLngExpression[] = [];

    const ridersToDisplay = riderLocations.filter(loc => {
      const resolved = db.resolveUser(loc.riderId);
      const riderIdToCheck = resolved ? resolved.id : loc.riderId;
      
      const lastUpdateMs = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
      const isOnline = lastUpdateMs > 0 && Math.abs(now - lastUpdateMs) < ONLINE_THRESHOLD_MS;
      
      return isOnline && scheduledRiderIds.has(riderIdToCheck);
    });

    const visibleIds = new Set(ridersToDisplay.map(r => r.riderId));

    Object.keys(markersRef.current).forEach(markerId => {
      if (!visibleIds.has(markerId)) {
        currentMap.removeLayer(markersRef.current[markerId]);
        delete markersRef.current[markerId];
      }
    });

    ridersToDisplay.forEach(loc => {
      if (!loc.lat || !loc.lng || isNaN(loc.lat) || isNaN(loc.lng)) return;

      points.push([loc.lat, loc.lng]);
      const riderName = loc.riderName || 'Entregador';
      const existingMarker = markersRef.current[loc.riderId];

      if (existingMarker) {
        existingMarker.setLatLng([loc.lat, loc.lng]);
      } else {
        const riderIcon = L.divIcon({
          html: `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div style="background: #0f172a; color: white; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; white-space: nowrap; margin-bottom: 2px; border: 1px solid #334155;">
                ${riderName}
              </div>
              <div style="background-color: #10b981; color: white; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 6px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M18 18v-3l-3-4H9l-3 4v3" /><rect x="8" y="6" width="5" height="5" rx="1" /><path d="M15 11l1.5-4.5H19" /></svg>
              </div>
            </div>
          `,
          className: 'custom-est-rider-icon',
          iconSize: [80, 55],
          iconAnchor: [40, 45]
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: riderIcon }).addTo(currentMap).bindPopup(`<b>${riderName}</b>`);
        markersRef.current[loc.riderId] = marker;
      }
    });

    if (!hasSetInitialMapBoundsRef.current && points.length > 0) {
      if (points.length >= 2) {
        const bounds = L.latLngBounds(points);
        currentMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } else if (points.length === 1) {
        currentMap.setView(points[0], 16);
      }
      hasSetInitialMapBoundsRef.current = true;
    }
  }, [riderLocations, scheduledRiderIds]);

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
    const link = `${window.location.origin}/#/track/${deliveryId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(deliveryId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleApproveDelivery = (id: string) => {
    const allDeliveries = db.getDeliveries();
    const updated = allDeliveries.map(d => d.id === id ? { ...d, status: 'active' as const, updatedAt: new Date().toISOString() } : d);
    db.setDeliveries(updated);
    loadData();
  };

  const handleRejectDelivery = (id: string) => {
    const reason = prompt('Digite o motivo da rejeição:');
    if (reason !== null) {
      const allDeliveries = db.getDeliveries();
      const updated = allDeliveries.map(d => d.id === id ? {
        ...d,
        status: 'rejected' as const,
        notes: d.notes ? `${d.notes}\nRejeitado: ${reason}` : `Rejeitado: ${reason}`,
        updatedAt: new Date().toISOString()
      } : d);
      db.setDeliveries(updated);
      loadData();
    }
  };

  const handleOpenLaunchModal = (riderIdToPreselect?: string) => {
    if (!currentEst) return;
    setEditingDelivery(null);
    setDeliveryForm({
      riderId: riderIdToPreselect || (queue.length > 0 ? queue[0].riderId : (allRiders.length > 0 ? allRiders[0].id : '')),
      establishmentId: currentEst.id,
      date: todayStr,
      time: new Date().toTimeString().slice(0, 5),
      value: '',
      orderNumber: '',
      notes: ''
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
      value: del.value.toString(),
      orderNumber: del.orderNumber || '',
      notes: del.notes || ''
    });
    setShowDeliveryModal(true);
  };

  const handleRestoreDelivery = (id: string) => {
    const allDeliveries = db.getDeliveries();
    const updated = allDeliveries.map(d =>
      d.id === id && d.status === 'lost'
        ? { ...d, status: 'pending' as const, lostAt: undefined, lostReason: undefined, updatedAt: new Date().toISOString() }
        : d
    );
    db.setDeliveries(updated);
    loadData();
  };

  const handleSaveDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEst) return;

    const val = parseFloat(deliveryForm.value);
    if (isNaN(val) || val <= 0) {
      alert('Erro: O valor da corrida deve ser maior que zero.');
      return;
    }

    const allDeliveries = db.getDeliveries();
    const nowStr = new Date().toISOString();

    if (editingDelivery) {
      const updated = allDeliveries.map(d => d.id === editingDelivery.id ? {
        ...d,
        riderId: deliveryForm.riderId,
        date: deliveryForm.date,
        time: deliveryForm.time,
        value: val,
        orderNumber: deliveryForm.orderNumber.trim() || undefined,
        notes: deliveryForm.notes.trim() || undefined,
        updatedAt: nowStr
      } : d);
      db.setDeliveries(updated);
    } else {
      const newDelivery: Delivery = {
        id: 'd_' + Date.now(),
        riderId: deliveryForm.riderId,
        establishmentId: currentEst.id,
        date: deliveryForm.date,
        time: deliveryForm.time,
        value: val,
        status: 'active',
        orderNumber: deliveryForm.orderNumber.trim() || undefined,
        notes: deliveryForm.notes.trim() || undefined,
        updatedAt: nowStr,
        paid: false
      };
      db.setDeliveries([...allDeliveries, newDelivery]);
      db.markRiderDelivering(deliveryForm.riderId, currentEst.id);
    }

    setShowDeliveryModal(false);
    setEditingDelivery(null);
    loadData();
  };

  const handleAddRiderToQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEst || !selectedQueueRiderId) return;

    db.joinQueue(selectedQueueRiderId, currentEst.id);
    setShowAddQueueModal(false);
    setSelectedQueueRiderId('');
    loadData();
    window.dispatchEvent(new Event('queue-updated'));
  };

  const handleRemoveFromQueue = (riderId: string) => {
    if (!currentEst) return;
    db.leaveQueue(riderId, currentEst.id);
    loadData();
    window.dispatchEvent(new Event('queue-updated'));
  };

  const handleMoveToFirstInQueue = (entryId: string) => {
    if (!currentEst) return;
    const currentQueueIds = queue.map(q => q.id);
    const reorderedIds = [entryId, ...currentQueueIds.filter(id => id !== entryId)];
    db.reorderQueue(currentEst.id, reorderedIds);
    loadData();
    window.dispatchEvent(new Event('queue-updated'));
  };

  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    if (!currentEst) return;
    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newQueue.length) return;

    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;

    const reorderedIds = newQueue.map(q => q.id);
    db.reorderQueue(currentEst.id, reorderedIds);
    loadData();
    window.dispatchEvent(new Event('queue-updated'));
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

  if (user && !currentEst && db.getEstablishments().length > 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md space-y-4">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto" />
          <h2 className="text-xl font-black text-slate-800">Estabelecimento não localizado</h2>
          <p className="text-sm text-slate-600">Seu usuário de gerente ainda não possui um estabelecimento vinculado ou o vínculo foi removido. Fale com o administrador do sistema.</p>
          <button onClick={handleLogout} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Voltar para Login</button>
        </div>
      </div>
    );
  }

  // Métricas de Hoje (operacional)
  const todayDeliveries = deliveries.filter(d => db.isSameDayString(d.date, todayStr));
  const todayApprovedDeliveries = todayDeliveries.filter(d => d.status === 'active');
  const todayRevenue = todayApprovedDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);

  const onlineRidersCount = riderLocations.filter(l => {
    const resolved = db.resolveUser(l.riderId);
    const riderIdToCheck = resolved ? resolved.id : l.riderId;
    if (!scheduledRiderIds.has(riderIdToCheck)) return false;
    
    const lastUpdateMs = l.updatedAt ? new Date(l.updatedAt).getTime() : 0;
    return lastUpdateMs > 0 && (Date.now() - lastUpdateMs < 60 * 1000);
  }).length;

  const filteredDeliveries = deliveries
    .filter(d => {
      if (riderFilter !== 'all' && d.riderId !== riderFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;

      if (timeframeFilter === 'today' && !db.isSameDayString(d.date, todayStr)) return false;

      if (timeframeFilter === '7days') {
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        const limitStr = db.getOperationalDateString(d7);
        if (d.date < limitStr) return false;
      }

      if (timeframeFilter === '30days') {
        const d30 = new Date();
        d30.setDate(d30.getDate() - 30);
        const limitStr = db.getOperationalDateString(d30);
        if (d.date < limitStr) return false;
      }

      if (timeframeFilter === 'custom') {
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

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
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
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl flex-shrink-0">
                  <ListOrdered className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Fila de Saída dos Motoboys</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Gerencie a ordem, adicione e coloque o motoboy na vez</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                <button
                  onClick={() => setShowAddQueueModal(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
                  title="Inserir motoboy na fila manualmente"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>+ Adicionar na Fila</span>
                </button>

                <button
                  onClick={() => handleOpenLaunchModal(queue.length > 0 ? queue[0].riderId : undefined)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center space-x-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>{queue.length > 0 ? `Lançar para 1º da Fila` : 'Lançar Corrida'}</span>
                </button>
              </div>
            </div>

            {queue.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 max-w-lg mx-auto my-2 space-y-2">
                <p>Nenhum entregador na fila no momento.</p>
                <button
                  onClick={() => setShowAddQueueModal(true)}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  + Adicionar motoboy na fila agora
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 bg-slate-50/50 rounded-xl border border-slate-200/80 overflow-hidden">
                {queue.map((q, idx) => {
                  const riderUser = db.resolveUser(q.riderId);
                  const arrivalTime = new Date(q.joinedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const isFirst = idx === 0;

                  return (
                    <div key={q.id} className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isFirst ? 'bg-emerald-50/80 border-l-4 border-l-emerald-500' : ''}`}>
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          isFirst ? 'bg-emerald-600 text-white shadow-md animate-pulse' : 'bg-slate-200 text-slate-700'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 text-sm truncate">{riderUser?.name || 'Entregador'}</p>
                            {isFirst && (
                              <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                                <Crown className="h-3 w-3 text-amber-300" /> 1º DA VEZ
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">Entrou na fila às {arrivalTime}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-wrap justify-end flex-shrink-0">
                        {!isFirst && (
                          <button
                            onClick={() => handleMoveToFirstInQueue(q.id)}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            title="Colocar este motoboy em 1º da fila"
                          >
                            <Crown className="h-3.5 w-3.5 text-amber-600" />
                            <span>Colocar em 1º</span>
                          </button>
                        )}

                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveQueueItem(idx, 'up')}
                            className="p-1 text-slate-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-600"
                            title="Subir Posição"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            disabled={idx === queue.length - 1}
                            onClick={() => handleMoveQueueItem(idx, 'down')}
                            className="p-1 text-slate-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-600"
                            title="Descer Posição"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleOpenLaunchModal(q.riderId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                            isFirst ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>{isFirst ? 'Lançar (Vez)' : 'Lançar'}</span>
                        </button>

                        <button
                          onClick={() => handleRemoveFromQueue(q.riderId)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover da fila"
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

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-base">
                  Motoboys Escalados Hoje ({todaySchedules.length})
                </h3>
              </div>

              <button
                onClick={() => handleOpenLaunchModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center space-x-1.5 self-start sm:self-center"
              >
                <Plus className="h-4 w-4" />
                <span>Lançar Corrida</span>
              </button>
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
                  const isOnline = loc && loc.updatedAt && (Date.now() - new Date(loc.updatedAt).getTime() < 60 * 1000);

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
                            onClick={() => setActiveScheduleChatId(sch.id)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="Chat do Turno"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          <span 
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} 
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
            </div>

            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase text-slate-600 flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-indigo-600" />
                  <span>Filtros do Histórico</span>
                </p>

                {(timeframeFilter !== 'today' || statusFilter !== 'all' || riderFilter !== 'all' || dateFrom || dateTo) && (
                  <button
                    onClick={() => {
                      setTimeframeFilter('today');
                      setStatusFilter('all');
                      setRiderFilter('all');
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-indigo-600" />
                    <span>Período de Exibição</span>
                  </label>
                  <select
                    value={timeframeFilter}
                    onChange={(e) => setTimeframeFilter(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700"
                  >
                    <option value="today">Somente Hoje (Turno Atual)</option>
                    <option value="7days">Últimos 7 dias</option>
                    <option value="30days">Últimos 30 dias</option>
                    <option value="all">Todas as Datas (Histórico Completo)</option>
                    <option value="custom">Período Personalizado</option>
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
                    <option value="lost">Ocultadas / Perdidas</option>
                    <option value="cancelled">Canceladas</option>
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
              </div>

              {timeframeFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-200">
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

                  return (
                    <div key={del.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          {del.orderNumber && (
                            <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                              #{del.orderNumber}
                            </span>
                          )}
                          <p className="font-extrabold text-slate-800 text-sm truncate">{rider?.name || 'Motoboy'}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            del.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            del.status === 'pending' ? 'bg-amber-100 text-amber-800 font-black animate-pulse' :
                            del.status === 'lost' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {del.status === 'active' ? 'Aprovada' : del.status === 'pending' ? 'Pendente' : del.status === 'lost' ? '⚠️ Ocultada' : 'Rejeitada'}
                          </span>
                        </div>
                        <p className="text-slate-400">
                          Data: {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 flex-wrap flex-shrink-0">
                        {(del.status === 'pending' || del.status === 'lost') && (
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
                            <span className="bg-amber-990 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
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

                        {del.status === 'lost' && (
                          <button
                            onClick={() => handleRestoreDelivery(del.id)}
                            className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Restaurar corrida para o motoboy"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            <span>Restaurar</span>
                          </button>
                        )}

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

        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4 sticky top-20">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <MapIcon className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Central de Rastreamento</h3>
                  <p className="text-[11px] text-slate-400">{onlineRidersCount} motoboy(s) ativo(s) com sinal GPS</p>
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
                      <p className="text-xs text-slate-400">{onlineRidersCount} motoboy(s) ativos com sinal GPS</p>
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

      {showAddQueueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                <span>Adicionar Motoboy na Fila</span>
              </h3>
              <button onClick={() => setShowAddQueueModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddRiderToQueue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Selecione o Motoboy</label>
                <select
                  required
                  value={selectedQueueRiderId}
                  onChange={(e) => setSelectedQueueRiderId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Selecione um motoboy...</option>
                  {allRiders.map(r => {
                    const inQ = queue.some(q => q.riderId === r.id);
                    return (
                      <option key={r.id} value={r.id} disabled={inQ}>
                        {r.name} {inQ ? '(Já está na fila)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddQueueModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedQueueRiderId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Colocar na Fila
                </button>
              </div>
            </form>
          </div>
        </div>
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