"use client";

import React, { useEffect, useRef, useState } from 'react';
import { 
  Navigation, MapPin, Maximize2, Minimize2, RotateCcw, Clock, X, Search,
  Volume2, VolumeX, Play, Square, Loader2, Check, ArrowUp, Hand, AlertCircle,
  Bike, Mic, MicOff, Plus, Trash2, ListPlus, Flag, Compass, LocateFixed,
  History, Moon, Sun, Sparkles, Expand, RotateCw, Info, Navigation2
} from 'lucide-react';
import L from 'leaflet';
import { gpsTracker, GpsState, isPointOffRoute, calculateDistanceMeters, getShortestAngleDiff } from '../utils/gpsTracker';
import { searchFreeTextAddress, geocodeByPlaceId, fetchAutocompleteSuggestions, parseAddressQuery, AutocompleteSuggestion } from '../utils/geocoding';
import { computeRoute, RouteResult, optimizeAllPointsSequence } from '../utils/googleRoutes';
import { db, RouteHistoryItem } from '../utils/db';

interface RiderNavigationMapProps {
  currentLocation: { lat: number; lng: number } | null;
  destination: { name: string; addressText: string; lat?: number; lng?: number; } | null;
  onClose?: () => void;
  defaultFullscreen?: boolean;
}

export interface StopWaypoint { id: string; name: string; addressText: string; lat: number; lng: number; }

export default function RiderNavigationMap({ 
  currentLocation: externalLocation, 
  destination: initialDestination, 
  onClose,
  defaultFullscreen = false 
}: RiderNavigationMapProps) {
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);
  const routePolylineOuterRef = useRef<L.Polyline | null>(null);
  const routePolylineInnerRef = useRef<L.Polyline | null>(null);

  const lastFetchedRouteKeyRef = useRef<string>('');
  const lastRecalculateTimeRef = useRef<number>(0);
  const [rotationAngle, setRotationAngle] = useState<number>(0);

  const currentUser = db.getCurrentUser();
  const navStorageKey = currentUser ? `motoboy_active_nav_${currentUser.id}` : null;

  const [gpsState, setGpsState] = useState<GpsState>({
    currentLocation: null, quality: 'off', errorMessage: null, isNavigating: false
  });

  const [activeDestination, setActiveDestination] = useState<any>(() => {
    if (navStorageKey) {
      try {
        const saved = localStorage.getItem(navStorageKey);
        if (saved) return JSON.parse(saved).activeDestination;
      } catch (e) {}
    }
    return initialDestination;
  });

  const [waypoints, setWaypoints] = useState<StopWaypoint[]>(() => {
    if (navStorageKey) {
      try {
        const saved = localStorage.getItem(navStorageKey);
        if (saved) return JSON.parse(saved).waypoints || [];
      } catch (e) {}
    }
    return [];
  });

  const [isNavigating, setIsNavigating] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeDetails, setRouteDetails] = useState<RouteResult | null>(null);
  const [isOffRouteDetected, setIsOffRouteDetected] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [headsUpMode, setHeadsUpMode] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AutocompleteSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Efeito para salvar estado
  useEffect(() => {
    if (!navStorageKey) return;
    localStorage.setItem(navStorageKey, JSON.stringify({ activeDestination, waypoints, isNavigating }));
  }, [activeDestination, waypoints, isNavigating, navStorageKey]);

  useEffect(() => {
    gpsTracker.startTracking();
    return gpsTracker.subscribe(setGpsState);
  }, []);

  const activePos = gpsState.currentLocation;

  // Lógica principal de cálculo de rota por etapas
  useEffect(() => {
    if (!isNavigating || !activePos || !activeDestination) return;

    // Identifica o próximo ponto imediato (parada ou destino final)
    const nextTarget = waypoints.length > 0 ? waypoints[0] : activeDestination;
    if (!nextTarget.lat || !nextTarget.lng) return;

    const routeKey = `${activePos.lat.toFixed(5)},${activePos.lng.toFixed(5)}->${nextTarget.lat.toFixed(5)},${nextTarget.lng.toFixed(5)}`;
    
    // Verifica "fora de rota" com mais sensibilidade (25 metros)
    const now = Date.now();
    const offRoute = isPointOffRoute({ lat: activePos.lat, lng: activePos.lng }, routeCoordinates, 25);

    if (offRoute && (now - lastRecalculateTimeRef.current > 3000)) {
        setIsOffRouteDetected(true);
    }

    if (lastFetchedRouteKeyRef.current === routeKey && !isOffRouteDetected) return;

    const fetchNextLeg = async () => {
      setLoadingRoute(true);
      try {
        const result = await computeRoute({
          origin: {
            lat: activePos.lat,
            lng: activePos.lng,
            heading: activePos.speedKmh >= 3 ? activePos.heading : undefined
          },
          destination: { lat: nextTarget.lat, lng: nextTarget.lng },
          travelMode: 'TWO_WHEELER'
        });

        setRouteCoordinates(result.coordinates);
        setRouteDetails(result);
        lastFetchedRouteKeyRef.current = routeKey;
        setIsOffRouteDetected(false);
        lastRecalculateTimeRef.current = Date.now();
      } catch (err) {
        console.warn('Erro ao calcular etapa:', err);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchNextLeg();
  }, [activePos?.lat, activePos?.lng, waypoints.length, isNavigating, isOffRouteDetected, activeDestination]);

  // Lógica de chegada em pontos
  useEffect(() => {
    if (!isNavigating || !activePos) return;
    const nextTarget = waypoints.length > 0 ? waypoints[0] : activeDestination;
    if (!nextTarget?.lat) return;

    const dist = calculateDistanceMeters(activePos.lat, activePos.lng, nextTarget.lat, nextTarget.lng);
    
    if (dist <= 25) { // Chegou no ponto
      if (waypoints.length > 0) {
        if (voiceEnabled) window.speechSynthesis.speak(new SpeechSynthesisUtterance(`Você chegou na parada ${waypoints[0].name}. Seguindo para o próximo ponto.`));
        setWaypoints(prev => prev.slice(1));
        setIsOffRouteDetected(true); // Força novo cálculo para o próximo ponto
      } else {
        if (voiceEnabled) window.speechSynthesis.speak(new SpeechSynthesisUtterance("Você chegou ao destino final. Navegação concluída."));
        setIsNavigating(false);
      }
    }
  }, [activePos?.lat, activePos?.lng, waypoints.length, isNavigating]);

  // Inicialização e atualização do Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView([-7.2247, -35.8878], 16);
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(mapRef.current);
    
    mapRef.current.on('dragstart', () => setAutoFollow(false));
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activePos) return;

    if (autoFollow) {
      map.panTo([activePos.lat, activePos.lng], { animate: true });
      if (headsUpMode && activePos.speedKmh >= 3) {
        setRotationAngle((360 - activePos.heading) % 360);
      }
    }

    if (!riderMarkerRef.current) {
        const icon = L.divIcon({ 
            html: '<div style="background:#1a73e8;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 19 21 12 17 5 21 12 2"></polygon></svg></div>',
            className: 'rider-nav-marker', iconSize: [36, 36], iconAnchor: [18, 18]
        });
        riderMarkerRef.current = L.marker([activePos.lat, activePos.lng], { icon, zIndexOffset: 3000 }).addTo(map);
    } else {
        riderMarkerRef.current.setLatLng([activePos.lat, activePos.lng]);
        const el = riderMarkerRef.current.getElement()?.firstChild as HTMLElement;
        if (el) el.style.transform = `rotate(${activePos.heading}deg)`;
    }

    if (routeCoordinates.length > 0) {
      if (!routePolylineOuterRef.current) {
        routePolylineOuterRef.current = L.polyline(routeCoordinates, { color: '#0d47a1', weight: 8, opacity: 0.8 }).addTo(map);
        routePolylineInnerRef.current = L.polyline(routeCoordinates, { color: '#2563eb', weight: 4, opacity: 1 }).addTo(map);
      } else {
        routePolylineOuterRef.current.setLatLngs(routeCoordinates);
        routePolylineInnerRef.current.setLatLngs(routeCoordinates);
      }
    } else {
        if (routePolylineOuterRef.current) { map.removeLayer(routePolylineOuterRef.current); routePolylineOuterRef.current = null; }
        if (routePolylineInnerRef.current) { map.removeLayer(routePolylineInnerRef.current); routePolylineInnerRef.current = null; }
    }
  }, [activePos, routeCoordinates, autoFollow, headsUpMode]);

  return (
    <div ref={outerContainerRef} className="relative flex flex-col bg-slate-950 text-white w-full h-[calc(100vh-140px)] rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Header Info */}
      <div className="bg-[#137333] px-3 py-2 z-30 flex items-center justify-between border-b border-emerald-800 flex-shrink-0">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="p-1.5 bg-black/20 rounded-lg"><ArrowUp className="h-5 w-5" /></div>
            <div className="min-w-0">
                <span className="text-[9px] font-black uppercase text-emerald-300">Google GPS (Menor Percurso)</span>
                <h2 className="text-xs font-bold truncate leading-tight">
                    {waypoints.length > 0 ? `Parada: ${waypoints[0].name}` : activeDestination?.name || 'Selecione um destino'}
                </h2>
            </div>
        </div>
        <div className="flex items-center space-x-1">
            <button onClick={() => setHeadsUpMode(!headsUpMode)} className={`p-1.5 rounded-lg ${headsUpMode ? 'bg-emerald-600' : 'bg-emerald-900'}`}><Compass className="h-4 w-4" /></button>
            <button onClick={() => setVoiceEnabled(!voiceEnabled)} className={`p-1.5 rounded-lg ${voiceEnabled ? 'bg-emerald-600' : 'bg-emerald-900'}`}>{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
        </div>
      </div>

      {/* Map Area */}
      <div className="relative flex-1 min-h-0 touch-none">
        <div style={{ transform: `rotate(${rotationAngle}deg)`, transition: 'transform 0.3s ease-out', width: '400%', height: '400%', position: 'absolute', top: '-150%', left: '-150%' }}>
          <div ref={mapContainerRef} className="w-full h-full bg-slate-900" />
        </div>

        {/* Speedometer */}
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 border-2 border-slate-700 p-2 rounded-xl text-center min-w-[50px]">
            <p className="text-xl font-black font-mono leading-none">{activePos?.speedKmh || 0}</p>
            <p className="text-[8px] font-bold uppercase opacity-60">km/h</p>
        </div>

        {/* Controls */}
        <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
            <button onClick={() => { setAutoFollow(true); setHeadsUpMode(true); }} className="p-2.5 bg-emerald-500 text-slate-900 rounded-full shadow-lg animate-pulse"><LocateFixed className="h-5 w-5" /></button>
            <button onClick={() => setRotationAngle(0)} className={`p-2.5 bg-slate-800 text-white rounded-full shadow-lg transition-transform ${rotationAngle !== 0 ? 'scale-100' : 'scale-0'}`}><Compass className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-slate-900 p-3 z-30 border-t border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 flex-1">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><Clock className="h-5 w-5" /></div>
            <div>
                <p className="text-sm font-black text-emerald-400">
                    {routeDetails ? `${Math.ceil(routeDetails.durationSeconds / 60)} min` : '--'}
                    <span className="text-xs text-slate-500 font-bold ml-1">({routeDetails ? `${(routeDetails.distanceMeters / 1000).toFixed(1)} km` : '--'})</span>
                </p>
                <p className="text-[10px] text-slate-400 font-bold">Chegada: {routeDetails?.etaTimeString || '--:--'}</p>
            </div>
        </div>

        <button
          onClick={() => {
            if (!isNavigating && !activeDestination) return alert("Defina um destino.");
            setIsNavigating(!isNavigating);
            if (!isNavigating) {
                setAutoFollow(true);
                setHeadsUpMode(true);
                setIsOffRouteDetected(true);
            }
          }}
          className={`px-5 py-3 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all ${
            isNavigating ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white'
          }`}
        >
          {isNavigating ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          <span>{isNavigating ? 'PARAR' : 'INICIAR'}</span>
        </button>
      </div>
    </div>
  );
}