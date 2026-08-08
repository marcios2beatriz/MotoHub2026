"use client";

import React, { useEffect, useRef, useState } from 'react';
import { 
  Navigation, 
  MapPin, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Clock, 
  X, 
  Search,
  Volume2, 
  VolumeX,
  Play,
  Square,
  Loader2,
  Check,
  ArrowUp,
  Hand,
  AlertCircle,
  Bike,
  Mic,
  MicOff,
  Plus,
  Trash2,
  ListPlus,
  Flag,
  Compass,
  LocateFixed,
  History,
  Moon,
  Sun,
  Sparkles,
  Expand,
  RotateCw,
  Info,
  Navigation2
} from 'lucide-react';
import L from 'leaflet';
import { gpsTracker, GpsState, isPointOffRoute, calculateDistanceMeters, getShortestAngleDiff } from '../utils/gpsTracker';
import { searchFreeTextAddress, geocodeByPlaceId, fetchAutocompleteSuggestions, parseAddressQuery, AutocompleteSuggestion } from '../utils/geocoding';
import { computeRoute, RouteResult, optimizeAllPointsSequence } from '../utils/googleRoutes';
import { db, RouteHistoryItem } from '../utils/db';

interface RiderNavigationMapProps {
  currentLocation: { lat: number; lng: number } | null;
  destination: {
    name: string;
    addressText: string;
    lat?: number;
    lng?: number;
  } | null;
  onClose?: () => void;
  defaultFullscreen?: boolean;
}

interface PendingConfirmation {
  name: string;
  addressText: string;
  lat: number;
  lng: number;
  isApproximate?: boolean;
  locationType?: string;
  exactNumberMatched?: boolean;
  exactStreetMatched?: boolean;
  requestedNumber?: string | null;
  unconfirmedReason?: string;
  placeId?: string;
  isAddingAsWaypoint?: boolean;
}

export interface StopWaypoint {
  id: string;
  name: string;
  addressText: string;
  lat: number;
  lng: number;
}

export interface RecentSearchItem {
  id: string;
  title: string;
  subtitle: string;
  fullAddress: string;
  lat?: number;
  lng?: number;
}

const RECENT_SEARCHES_KEY = 'motoboy_recent_searches_v2';

function getRecentSearches(): RecentSearchItem[] {
  try {
    const data = localStorage.getItem(RECENT_SEARCHES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveRecentSearch(title: string, subtitle: string, fullAddress: string, lat?: number, lng?: number) {
  try {
    const current = getRecentSearches().filter(s => s.title.toLowerCase() !== title.toLowerCase());
    const newItem: RecentSearchItem = {
      id: 'rec_' + Date.now(),
      title,
      subtitle,
      fullAddress,
      lat,
      lng
    };
    const updated = [newItem, ...current].slice(0, 8);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch (e) {}
}

function getRemainingRoute(currentPos: { lat: number; lng: number } | null, coords: [number, number][]): [number, number][] {
  if (coords.length < 2) return coords;
  if (!currentPos) return coords;
  
  let closestIdx = 0;
  let minDistance = Infinity;

  for (let i = 0; i < coords.length; i++) {
    const dist = calculateDistanceMeters(currentPos.lat, currentPos.lng, coords[i][0], coords[i][1]);
    if (dist < minDistance) {
      minDistance = dist;
      closestIdx = i;
    }
  }

  const remaining = coords.slice(closestIdx);
  return [[currentPos.lat, currentPos.lng], ...remaining];
}

export default function RiderNavigationMap({ 
  currentLocation: externalLocation, 
  destination: initialDestination, 
  onClose,
  defaultFullscreen = false 
}: RiderNavigationMapProps) {
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const trafficLayerRef = useRef<L.TileLayer | null>(null);

  const riderMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);
  const pendingMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineOuterRef = useRef<L.Polyline | null>(null);
  const routePolylineInnerRef = useRef<L.Polyline | null>(null);

  const initialCenterDoneRef = useRef(false);
  const lastFetchedRouteKeyRef = useRef<string>('');
  const lastRecalculateTimeRef = useRef<number>(0);
  const searchTimeoutRef = useRef<any>(null);
  const autoRecenterTimerRef = useRef<any>(null);
  const lastArrivedStopIdRef = useRef<string>('');

  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const lastMapRotationRef = useRef<number>(0);

  const touchStartAngleRef = useRef<number | null>(null);
  const initialMapAngleRef = useRef<number>(0);

  const singleTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const rotationAngleRef = useRef<number>(0);
  rotationAngleRef.current = rotationAngle;

  const currentUser = db.getCurrentUser();
  const navStorageKey = currentUser ? `motoboy_active_nav_${currentUser.id}` : null;

  const [gpsState, setGpsState] = useState<GpsState>({
    currentLocation: null,
    quality: 'off',
    errorMessage: null,
    isNavigating: false
  });

  const [activeDestination, setActiveDestination] = useState<{
    name: string;
    addressText: string;
    lat?: number;
    lng?: number;
  } | null>(() => {
    if (navStorageKey) {
      try {
        const saved = localStorage.getItem(navStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.activeDestination) return parsed.activeDestination;
        }
      } catch (e) {}
    }
    return initialDestination;
  });

  const [waypoints, setWaypoints] = useState<StopWaypoint[]>(() => {
    if (navStorageKey) {
      try {
        const saved = localStorage.getItem(navStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.waypoints)) return parsed.waypoints;
        }
      } catch (e) {}
    }
    return [];
  });

  const [isNavigating, setIsNavigating] = useState<boolean>(() => {
    if (navStorageKey) {
      try {
        const saved = localStorage.getItem(navStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.isNavigating === 'boolean') return parsed.isNavigating;
        }
      } catch (e) {}
    }
    return false;
  });

  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>(() => {
    if (navStorageKey) {
      try {
        const saved = localStorage.getItem(navStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.routeCoordinates)) return parsed.routeCoordinates;
        }
      } catch (e) {}
    }
    return [];
  });

  const [routeDetails, setRouteDetails] = useState<RouteResult | null>(() => {
    if (navStorageKey) {
      try {
        const saved = localStorage.getItem(navStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.routeDetails) return parsed.routeDetails;
        }
      } catch (e) {}
    }
    return null;
  });

  useEffect(() => {
    if (!navStorageKey) return;
    try {
      const sessionData = {
        activeDestination,
        waypoints,
        isNavigating,
        routeCoordinates,
        routeDetails
      };
      localStorage.setItem(navStorageKey, JSON.stringify(sessionData));
    } catch (e) {}
  }, [navStorageKey, activeDestination, waypoints, isNavigating, routeCoordinates, routeDetails]);

  useEffect(() => {
    gpsTracker.setNavigating(isNavigating);
  }, [isNavigating]);

  const [showWaypointsList, setShowWaypointsList] = useState(false);
  const [showRouteHistoryModal, setShowRouteHistoryModal] = useState(false);
  const [routeHistoryList, setRouteHistoryList] = useState<RouteHistoryItem[]>([]);

  const [nightMode, setNightMode] = useState(false);
  const [optimizationMessage, setOptimizationMessage] = useState<string | null>(null);

  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(getRecentSearches());
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [notFoundAlert, setNotFoundAlert] = useState<string | null>(null);
  const [routeErrorAlert, setRouteErrorAlert] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AutocompleteSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  const [isPinAdjustmentMode, setIsPinAdjustmentMode] = useState(false);
  const [tempAdjustedCoords, setTempAdjustedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
  const [isExpanded, setIsExpanded] = useState(false);

  const [autoFollow, setAutoFollow] = useState(true);
  const autoFollowRef = useRef<boolean>(true);
  autoFollowRef.current = autoFollow;

  const [autoRecenterCountdown, setAutoRecenterCountdown] = useState<number | null>(null);

  const [headsUpMode, setHeadsUpMode] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const isNavigatingRef = useRef<boolean>(isNavigating);
  isNavigatingRef.current = isNavigating;

  const [isOffRouteDetected, setIsOffRouteDetected] = useState(false);

  const [initialRouteDistance, setInitialRouteDistance] = useState<number | null>(null);

  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (activeDestination?.lat && activeDestination?.lng) {
      return { lat: activeDestination.lat, lng: activeDestination.lng };
    }
    return null;
  });
  const [loadingRoute, setLoadingRoute] = useState(false);

  const lastSpokenInstructionRef = useRef<string>('');
  const NAV_ZOOM_LEVEL = 18;

  const loadRouteHistory = () => {
    setRouteHistoryList(db.getRouteHistory());
  };

  useEffect(() => {
    loadRouteHistory();
    const handleHistoryUpdate = () => loadRouteHistory();
    window.addEventListener('route-history-updated', handleHistoryUpdate);
    return () => window.removeEventListener('route-history-updated', handleHistoryUpdate);
  }, []);

  const toggleFullscreen = () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);

    try {
      if (nextState) {
        const elem = outerContainerRef.current || document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if ((elem as any).webkitRequestFullscreen) {
          (elem as any).webkitRequestFullscreen();
        }
      } else {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          }
        }
      }
    } catch (e) {
      console.warn("API de tela cheia não suportada diretamente:", e);
    }
  };

  useEffect(() => {
    gpsTracker.startTracking();
    const unsubscribe = gpsTracker.subscribe((state) => {
      setGpsState(state);
    });
    return () => unsubscribe();
  }, []);

  const activePos = gpsState.currentLocation || (externalLocation ? {
    lat: externalLocation.lat,
    lng: externalLocation.lng,
    accuracy: 8,
    speedKmh: 0,
    heading: 0,
    timestamp: Date.now()
  } : null);

  const activePosRef = useRef<typeof activePos>(null);
  activePosRef.current = activePos;

  const triggerAutoRecenterTimer = () => {
    const isMoving = activePosRef.current && (activePosRef.current.speedKmh || 0) >= 3;
    const isNavigatingActive = isNavigatingRef.current;

    if (!isNavigatingActive || !isMoving) {
      if (autoRecenterTimerRef.current) {
        clearInterval(autoRecenterTimerRef.current);
      }
      setAutoRecenterCountdown(null);
      return;
    }

    if (autoRecenterTimerRef.current) {
      clearInterval(autoRecenterTimerRef.current);
    }

    let seconds = 6;
    setAutoRecenterCountdown(seconds);

    autoRecenterTimerRef.current = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        clearInterval(autoRecenterTimerRef.current);
        setAutoRecenterCountdown(null);
        handleRecenter();
      } else {
        setAutoRecenterCountdown(seconds);
      }
    }, 1000);
  };

  useEffect(() => {
    if (autoFollow) {
      if (autoRecenterTimerRef.current) {
        clearInterval(autoRecenterTimerRef.current);
      }
      setAutoRecenterCountdown(null);
    }
  }, [autoFollow]);

  useEffect(() => {
    const container = outerContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: false });
        if (autoFollowRef.current && activePosRef.current) {
          mapRef.current.panTo([activePosRef.current.lat, activePosRef.current.lng], { animate: false });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: true });
        if (activePosRef.current) {
          mapRef.current.panTo([activePosRef.current.lat, activePosRef.current.lng], { animate: true });
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isFullscreen, isExpanded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (rotationAngle !== 0) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
    }
  }, [rotationAngle]);

  const getTouchAngle = (t1: React.Touch | Touch, t2: React.Touch | Touch) => {
    const dy = t2.clientY - t1.clientY;
    const dx = t2.clientX - t1.clientX;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      singleTouchStartRef.current = null;
      const angle = getTouchAngle(e.touches[0], e.touches[1]);
      touchStartAngleRef.current = angle;
      initialMapAngleRef.current = rotationAngle;
    } else if (e.touches.length === 1 && rotationAngleRef.current !== 0) {
      singleTouchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      setAutoFollow(false);
      triggerAutoRecenterTimer();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // e.preventDefault() removido para evitar avisos 'passive event listener' no console.
    // A classe Tailwind 'touch-none' no contêiner já lida com o bloqueio da rolagem nativa.

    if (e.touches.length === 2 && touchStartAngleRef.current !== null) {
      const currentAngle = getTouchAngle(e.touches[0], e.touches[1]);
      const delta = currentAngle - touchStartAngleRef.current;
      let newAngle = (initialMapAngleRef.current + delta) % 360;
      if (newAngle < 0) newAngle += 360;
      setRotationAngle(Math.round(newAngle));
    } else if (e.touches.length === 1 && rotationAngleRef.current !== 0 && singleTouchStartRef.current && mapRef.current) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - singleTouchStartRef.current.x;
      const dy = currentY - singleTouchStartRef.current.y;

      singleTouchStartRef.current = { x: currentX, y: currentY };

      const rad = (-rotationAngleRef.current * Math.PI) / 180;
      const rotDx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const rotDy = dx * Math.sin(rad) + dy * Math.cos(rad);

      mapRef.current.panBy([-rotDx, -rotDy], { animate: false });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartAngleRef.current = null;
    }
    if (e.touches.length === 0) {
      singleTouchStartRef.current = null;
    }
  };

  const handleResetToNorth = () => {
    setRotationAngle(0);
    lastMapRotationRef.current = 0;
    setHeadsUpMode(false);
    if (mapRef.current && activePos) {
      mapRef.current.panTo([activePos.lat, activePos.lng], { animate: true });
    }
  };

  useEffect(() => {
    if (initialDestination) {
      setActiveDestination(initialDestination);
    }
  }, [initialDestination]);

  const speakInstruction = (text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    if (lastSpokenInstructionRef.current === text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    
    window.speechSynthesis.speak(utterance);
    lastSpokenInstructionRef.current = text;
  };

  const handleStartVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("A pesquisa por voz não é suportada por este navegador. Tente no Google Chrome ou Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningVoice(true);

      recognition.onstart = () => {
        speakInstruction("Fale o endereço desejado...");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setSearchQuery(transcript);
          handleSearchInput(transcript);
        }
        setIsListeningVoice(false);
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (e) {
      setIsListeningVoice(false);
    }
  };

  useEffect(() => {
    if (!activeDestination) return;

    if (activeDestination.lat && activeDestination.lng) {
      setDestCoords({ lat: activeDestination.lat, lng: activeDestination.lng });
      return;
    }

    const geocode = async () => {
      setLoadingRoute(true);
      const res = await searchFreeTextAddress(activeDestination.addressText);
      if (res) {
        setDestCoords({ lat: res.lat, lng: res.lng });
        setActiveDestination(prev => prev ? { ...prev, lat: res.lat, lng: res.lng } : prev);
      } else {
        setLoadingRoute(false);
      }
    };

    geocode();
  }, [activeDestination?.addressText, activeDestination?.name]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initialLat = activePos ? activePos.lat : -7.2247;
    const initialLng = activePos ? activePos.lng : -35.8878;

    const mapInstance = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([initialLat, initialLng], activePos ? NAV_ZOOM_LEVEL : 15);

    mapInstance.on('dragstart', () => {
      setAutoFollow(false);
      triggerAutoRecenterTimer();
    });

    mapInstance.on('zoomend', () => {
      if (autoFollowRef.current && activePosRef.current) {
        mapInstance.panTo([activePosRef.current.lat, activePosRef.current.lng], { animate: true });
      }
    });

    mapInstance.on('move', () => {
      if (isPinAdjustmentMode) {
        const center = mapInstance.getCenter();
        setTempAdjustedCoords({ lat: center.lat, lng: center.lng });
      }
    });

    mapRef.current = mapInstance;

    const tileUrl = nightMode 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const tileLayer = L.tileLayer(tileUrl, { maxZoom: 20 });
    tileLayer.addTo(mapInstance);
    tileLayerRef.current = tileLayer;

    if (!nightMode) {
      const trafficLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@121,traffic&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        opacity: 0.75
      });
      trafficLayer.addTo(mapInstance);
      trafficLayerRef.current = trafficLayer;
    }

    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        if (activePos) {
          mapRef.current.setView([activePos.lat, activePos.lng], NAV_ZOOM_LEVEL);
        }
      }
    }, 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    if (trafficLayerRef.current) {
      map.removeLayer(trafficLayerRef.current);
      trafficLayerRef.current = null;
    }

    const tileUrl = nightMode 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const newTileLayer = L.tileLayer(tileUrl, { maxZoom: 20 }).addTo(map);
    tileLayerRef.current = newTileLayer;

    if (!nightMode) {
      const newTrafficLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@121,traffic&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        opacity: 0.75
      }).addTo(map);
      trafficLayerRef.current = newTrafficLayer;
    }
  }, [nightMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pendingConfirmation) {
      const pendingIcon = L.divIcon({
        html: `
          <div style="
            background: #f59e0b;
            color: white;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: 3.5px solid white;
            box-shadow: 0 6px 20px rgba(245, 158, 11, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bounce 1s infinite;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        `,
        className: 'custom-pending-icon',
        iconSize: [42, 42],
        iconAnchor: [21, 21]
      });

      if (pendingMarkerRef.current) {
        pendingMarkerRef.current.setLatLng([pendingConfirmation.lat, pendingConfirmation.lng]);
      } else {
        pendingMarkerRef.current = L.marker([pendingConfirmation.lat, pendingConfirmation.lng], {
          icon: pendingIcon,
          zIndexOffset: 3500
        }).addTo(map);
      }

      map.panTo([pendingConfirmation.lat, pendingConfirmation.lng], { animate: true });
      setAutoFollow(false);
      triggerAutoRecenterTimer();
    } else {
      if (pendingMarkerRef.current) {
        map.removeLayer(pendingMarkerRef.current);
        pendingMarkerRef.current = null;
      }
    }
  }, [pendingConfirmation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activePos) return;

    const heading = activePos.heading || 0;
    const speed = activePos.speedKmh || 0;

    if (autoFollow && headsUpMode && !touchStartAngleRef.current) {
      if (speed >= 3) {
        const targetMapRotation = (360 - heading) % 360;
        const diff = Math.abs(getShortestAngleDiff(lastMapRotationRef.current, targetMapRotation));
        
        if (diff >= 8) {
          lastMapRotationRef.current = targetMapRotation;
          setRotationAngle(targetMapRotation);
        }
      }
    }

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLatLng([activePos.lat, activePos.lng]);

      const el = riderMarkerRef.current.getElement();
      if (el) {
        const rotateDiv = el.querySelector('.rider-heading-rotate') as HTMLElement;
        if (rotateDiv) {
          rotateDiv.style.transform = `rotate(${heading}deg)`;
        }
      }
    } else {
      const riderIcon = L.divIcon({
        html: `
          <div style="position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 48px; height: 48px; border-radius: 50%; background: rgba(26, 115, 232, 0.25); border: 2px solid #1a73e8; animation: pulse 2s infinite;"></div>
            <div class="rider-heading-rotate" style="
              transform: rotate(${heading}deg);
              transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
              background: #1a73e8;
              color: white;
              width: 40px;
              height: 40px;
              border-radius: 50%;
              border: 3px solid #ffffff;
              box-shadow: 0 6px 18px rgba(0,0,0,0.5);
              display: flex; align-items: center; justify-content: center; position: relative; z-index: 100;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
              </svg>
            </div>
          </div>
        `,
        className: 'custom-rider-google-nav-icon',
        iconSize: [56, 56],
        iconAnchor: [28, 28]
      });

      riderMarkerRef.current = L.marker([activePos.lat, activePos.lng], { 
        icon: riderIcon,
        zIndexOffset: 3000
      }).addTo(map);
    }

    if (!initialCenterDoneRef.current) {
      map.invalidateSize();
      map.setView([activePos.lat, activePos.lng], NAV_ZOOM_LEVEL);
      initialCenterDoneRef.current = true;
    } else if (autoFollow && !isPinAdjustmentMode && !pendingConfirmation) {
      map.panTo([activePos.lat, activePos.lng], { animate: true, duration: 0.6, easeLinearity: 0.2 });
    }

    if (routeCoordinates.length > 0 && map) {
      const remainingCoords = getRemainingRoute(activePos, routeCoordinates);
      
      if (routePolylineOuterRef.current) {
        routePolylineOuterRef.current.setLatLngs(remainingCoords);
      } else {
        routePolylineOuterRef.current = L.polyline(remainingCoords, {
          color: '#0d47a1',
          weight: 10,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
      }

      if (routePolylineInnerRef.current) {
        routePolylineInnerRef.current.setLatLngs(remainingCoords);
      } else {
        routePolylineInnerRef.current = L.polyline(remainingCoords, {
          color: '#2563eb',
          weight: 6,
          opacity: 1.0,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
      }
    }

    if (routeCoordinates.length > 0 && destCoords && isNavigating) {
      const now = Date.now();
      const offRoute = isPointOffRoute({ lat: activePos.lat, lng: activePos.lng }, routeCoordinates, 35);
      
      if (offRoute && (now - lastRecalculateTimeRef.current > 4000)) {
        lastRecalculateTimeRef.current = now;
        lastFetchedRouteKeyRef.current = '';
        setIsOffRouteDetected(true);
        speakInstruction('Você mudou de trajeto. Recalculando menor percurso...');
      }
    }
  }, [activePos?.lat, activePos?.lng, activePos?.heading, activePos?.speedKmh, autoFollow, headsUpMode, isNavigating, routeCoordinates, isPinAdjustmentMode, pendingConfirmation, destCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    waypointMarkersRef.current.forEach(m => map.removeLayer(m));
    waypointMarkersRef.current = [];

    waypoints.forEach((wp, idx) => {
      const waypointIcon = L.divIcon({
        html: `
          <div style="
            background: #8b5cf6;
            color: white;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            border: 2.5px solid white;
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 12px;
          ">
            P${idx + 1}
          </div>
        `,
        className: 'custom-waypoint-icon',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([wp.lat, wp.lng], {
        icon: waypointIcon,
        zIndexOffset: 2500
      }).addTo(map).bindPopup(`<b>Parada ${idx + 1}: ${wp.name}</b>`);

      waypointMarkersRef.current.push(marker);
    });
  }, [waypoints]);

  useEffect(() => {
    const map = mapRef.current;

    if (!isNavigating) {
      if (map) {
        if (routePolylineOuterRef.current) {
          map.removeLayer(routePolylineOuterRef.current);
          routePolylineOuterRef.current = null;
        }
        if (routePolylineInnerRef.current) {
          map.removeLayer(routePolylineInnerRef.current);
          routePolylineInnerRef.current = null;
        }
      }
      setRouteCoordinates([]);
      setRouteDetails(null);
      lastFetchedRouteKeyRef.current = '';
      return;
    }

    if (!map || !activePos || !destCoords) return;

    const coordsList: { lat: number; lng: number }[] = [activePos, ...waypoints, destCoords];
    const routeKey = coordsList.map(c => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`).join(';');
    
    if (lastFetchedRouteKeyRef.current === routeKey && !isOffRouteDetected && routeCoordinates.length > 0) {
      return;
    }

    const destIcon = L.divIcon({
      html: `
        <div style="
          background: #ea4335;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3.5px solid white;
          box-shadow: 0 4px 15px rgba(234,67,53,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      className: 'custom-dest-google-nav-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng([destCoords.lat, destCoords.lng]);
    } else {
      destMarkerRef.current = L.marker([destCoords.lat, destCoords.lng], { 
        icon: destIcon,
        zIndexOffset: 2000
      }).addTo(map);
    }

    const fetchGoogleRoute = async () => {
      setLoadingRoute(true);
      setRouteErrorAlert(null);
      try {
        const result = await computeRoute({
          origin: {
            lat: activePos.lat,
            lng: activePos.lng,
            heading: activePos.speedKmh >= 2 ? activePos.heading : undefined
          },
          destination: {
            lat: destCoords.lat,
            lng: destCoords.lng
          },
          waypoints: waypoints.map(w => ({ lat: w.lat, lng: w.lng, name: w.name })),
          travelMode: 'TWO_WHEELER',
          optimizeWaypoints: true
        });

        setRouteCoordinates(result.coordinates);
        setRouteDetails(result);
        if (initialRouteDistance === null) {
          setInitialRouteDistance(result.distanceMeters);
        }
        lastFetchedRouteKeyRef.current = routeKey;

        setIsOffRouteDetected(false);

        const currentUser = db.getCurrentUser();
        if (currentUser && activeDestination) {
          const now = new Date();
          const historyItem: RouteHistoryItem = {
            id: 'rh_' + Date.now(),
            riderId: currentUser.id,
            riderName: currentUser.name,
            date: db.getLocalDateString(now),
            time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            originName: 'Minha Posição Atual',
            destinationName: activeDestination.name,
            destinationAddress: activeDestination.addressText,
            destinationLat: destCoords.lat,
            destinationLng: destCoords.lng,
            waypointsCount: waypoints.length,
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
            createdAt: now.toISOString()
          };
          db.addRouteHistory(historyItem);
        }
      } catch (err: any) {
        console.warn('Erro ao calcular rota:', err);
        setRouteErrorAlert(err?.message || 'Erro ao calcular rota.');
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchGoogleRoute();
  }, [destCoords?.lat, destCoords?.lng, waypoints.length, isOffRouteDetected, isNavigating]);

  const currentNextTarget = waypoints.length > 0 
    ? { name: `Parada 1: ${waypoints[0].name}`, addressText: waypoints[0].addressText, lat: waypoints[0].lat, lng: waypoints[0].lng, isWaypoint: true, id: waypoints[0].id }
    : (activeDestination && destCoords ? { name: activeDestination.name, addressText: activeDestination.addressText, lat: destCoords.lat, lng: destCoords.lng, isWaypoint: false, id: 'final_dest' } : null);

  const distToNextTargetMeters = (activePos && currentNextTarget) 
    ? Math.round(calculateDistanceMeters(activePos.lat, activePos.lng, currentNextTarget.lat, currentNextTarget.lng)) 
    : null;

  useEffect(() => {
    if (!isNavigating || distToNextTargetMeters === null || !currentNextTarget) return;

    if (distToNextTargetMeters <= 30 && lastArrivedStopIdRef.current !== currentNextTarget.id) {
      lastArrivedStopIdRef.current = currentNextTarget.id;

      if (currentNextTarget.isWaypoint && waypoints.length > 0) {
        speakInstruction(`Você chegou na ${currentNextTarget.name}. Continuando navegando para os próximos pontos...`);
        setOptimizationMessage(`✅ Parada ${waypoints[0].name} concluída!`);
        setTimeout(() => setOptimizationMessage(null), 4000);
        
        lastFetchedRouteKeyRef.current = '';
        setWaypoints(prev => prev.slice(1));
      } else if (!currentNextTarget.isWaypoint) {
        speakInstruction(`Você chegou ao destino final ${currentNextTarget.name}. Rota encerrada.`);
        setOptimizationMessage(`🏁 Você chegou ao destino final!`);
        setTimeout(() => setOptimizationMessage(null), 5000);
      }
    }
  }, [distToNextTargetMeters, isNavigating, currentNextTarget, waypoints.length]);

  const handleOptimizeWaypointsSequence = () => {
    if (!activePos) return;

    const allTargetPoints: { id: string; name: string; addressText: string; lat: number; lng: number }[] = [
      ...waypoints
    ];

    if (destCoords && activeDestination) {
      allTargetPoints.push({
        id: 'dest_final',
        name: activeDestination.name,
        addressText: activeDestination.addressText,
        lat: destCoords.lat,
        lng: destCoords.lng
      });
    }

    if (allTargetPoints.length <= 1) {
      alert("Para otimizar o menor percurso, adicione pelo menos 2 endereços na rota.");
      return;
    }

    const orderedPoints = optimizeAllPointsSequence(activePos, allTargetPoints);

    const finalDest = orderedPoints.pop()!;
    const newWaypoints = orderedPoints;

    setWaypoints(newWaypoints);
    setDestCoords({ lat: finalDest.lat, lng: finalDest.lng });
    setActiveDestination({
      name: finalDest.name,
      addressText: finalDest.addressText,
      lat: finalDest.lat,
      lng: finalDest.lng
    });

    lastFetchedRouteKeyRef.current = '';

    setOptimizationMessage("⚡ Menor percurso recalculado com 2-Opt!");
    speakInstruction("Menor percurso calculado com sucesso.");
    setTimeout(() => setOptimizationMessage(null), 4000);
  };

  const handleRecenter = () => {
    setAutoFollow(true);
    setHeadsUpMode(true);
    if (autoRecenterTimerRef.current) {
      clearInterval(autoRecenterTimerRef.current);
    }
    setAutoRecenterCountdown(null);

    if (mapRef.current && activePos) {
      mapRef.current.invalidateSize({ animate: true });
      mapRef.current.panTo([activePos.lat, activePos.lng], { animate: true, duration: 0.6 });
      if (activePos.heading) {
        const targetRot = (360 - activePos.heading) % 360;
        lastMapRotationRef.current = targetRot;
        setRotationAngle(targetRot);
      }
    } else {
      gpsTracker.requestManualPermission();
    }
  };

  const handleSelectRecentItem = async (item: RecentSearchItem, isAddingAsWaypoint: boolean = false) => {
    setIsSearchFocused(false);
    setSearchResults([]);
    setIsSearching(true);

    let geocodeRes = null;
    if (item.lat && item.lng) {
      geocodeRes = {
        lat: item.lat,
        lng: item.lng,
        formattedAddress: item.fullAddress || item.title,
        isApproximate: false,
        exactNumberMatched: true,
        exactStreetMatched: true,
        source: 'recent_cache'
      };
    } else {
      geocodeRes = await searchFreeTextAddress(item.fullAddress || item.title);
    }

    setIsSearching(false);

    if (geocodeRes) {
      saveRecentSearch(item.title, item.subtitle || item.fullAddress, geocodeRes.formattedAddress || item.fullAddress, geocodeRes.lat, geocodeRes.lng);
      setRecentSearches(getRecentSearches());

      lastFetchedRouteKeyRef.current = '';

      if (isAddingAsWaypoint) {
        const newWp: StopWaypoint = {
          id: 'wp_' + Date.now(),
          name: item.title,
          addressText: geocodeRes.formattedAddress || item.fullAddress,
          lat: geocodeRes.lat,
          lng: geocodeRes.lng
        };
        setWaypoints(prev => [...prev, newWp]);
      } else {
        setDestCoords({ lat: geocodeRes.lat, lng: geocodeRes.lng });
        setActiveDestination({
          name: item.title,
          addressText: geocodeRes.formattedAddress || item.fullAddress,
          lat: geocodeRes.lat,
          lng: geocodeRes.lng
        });
      }

      if (mapRef.current) {
        mapRef.current.setView([geocodeRes.lat, geocodeRes.lng], 18);
      }

      setAutoFollow(false);
      triggerAutoRecenterTimer();
      setSearchQuery('');
    } else {
      setNotFoundAlert("Endereço não localizado. Posicione o pino no mapa.");
      handleEnablePinAdjustment();
    }
  };

  const handleExecuteDirectSearch = async (e?: React.FormEvent, isAddingAsWaypoint: boolean = false) => {
    if (e) e.preventDefault();

    const originalQuery = searchQuery.trim();
    if (!originalQuery) return;

    setSearchResults([]);
    setIsSearching(true);
    setNotFoundAlert(null);

    const geocodeResult = await searchFreeTextAddress(originalQuery);

    setIsSearching(false);

    if (geocodeResult) {
      const parsed = parseAddressQuery(originalQuery);
      const subtitle = `${parsed.neighborhood ? parsed.neighborhood + ', ' : ''}${parsed.city || 'Campina Grande'} - ${parsed.state || 'PB'}`;

      saveRecentSearch(originalQuery, subtitle, geocodeResult.formattedAddress || originalQuery, geocodeResult.lat, geocodeResult.lng);
      setRecentSearches(getRecentSearches());

      setPendingConfirmation({
        name: originalQuery,
        addressText: geocodeResult.formattedAddress || originalQuery,
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        isApproximate: geocodeResult.isApproximate,
        locationType: geocodeResult.locationType,
        exactNumberMatched: geocodeResult.exactNumberMatched,
        exactStreetMatched: geocodeResult.exactStreetMatched,
        requestedNumber: geocodeResult.requestedNumber,
        unconfirmedReason: geocodeResult.unconfirmedReason,
        placeId: geocodeResult.placeId,
        isAddingAsWaypoint
      });
    } else {
      const parsed = parseAddressQuery(originalQuery);
      const errorMsg = parsed.street
        ? `Não encontramos a via '${parsed.street}'. Posicione o pino manualmente no mapa.`
        : "Endereço não localizado. Posicione o pino no mapa.";

      setNotFoundAlert(errorMsg);
      handleEnablePinAdjustment();
    }
  };

  const handleConfirmLocation = () => {
    if (!pendingConfirmation) return;

    lastFetchedRouteKeyRef.current = '';

    if (pendingConfirmation.isAddingAsWaypoint) {
      const newWp: StopWaypoint = {
        id: 'wp_' + Date.now(),
        name: pendingConfirmation.name,
        addressText: pendingConfirmation.addressText,
        lat: pendingConfirmation.lat,
        lng: pendingConfirmation.lng
      };
      setWaypoints(prev => [...prev, newWp]);
    } else {
      setDestCoords({ lat: pendingConfirmation.lat, lng: pendingConfirmation.lng });
      setActiveDestination({
        name: pendingConfirmation.name,
        addressText: pendingConfirmation.addressText,
        lat: pendingConfirmation.lat,
        lng: pendingConfirmation.lng
      });
    }

    setPendingConfirmation(null);
    setAutoFollow(true);
    setHeadsUpMode(true);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const handleSelectSearchResult = async (result: AutocompleteSuggestion, isAddingAsWaypoint: boolean = false) => {
    setSearchResults([]);
    setIsSearching(true);

    let geocodeRes = null;

    if (result.lat && result.lng) {
      geocodeRes = {
        lat: result.lat,
        lng: result.lng,
        formattedAddress: result.fullAddress,
        isApproximate: false,
        exactNumberMatched: true,
        exactStreetMatched: true,
        source: 'geocoder_direct'
      };
    } else if (result.placeId) {
      geocodeRes = await geocodeByPlaceId(result.placeId);
    }

    if (!geocodeRes) {
      geocodeRes = await searchFreeTextAddress(result.fullAddress);
    }

    setIsSearching(false);

    if (geocodeRes) {
      saveRecentSearch(result.title, result.subtitle || result.fullAddress, geocodeRes.formattedAddress || result.fullAddress, geocodeRes.lat, geocodeRes.lng);
      setRecentSearches(getRecentSearches());

      lastFetchedRouteKeyRef.current = '';

      if (isAddingAsWaypoint) {
        const newWp: StopWaypoint = {
          id: 'wp_' + Date.now(),
          name: result.title,
          addressText: geocodeRes.formattedAddress || result.fullAddress,
          lat: geocodeRes.lat,
          lng: geocodeRes.lng
        };
        setWaypoints(prev => [...prev, newWp]);
      } else {
        setDestCoords({ lat: geocodeRes.lat, lng: geocodeRes.lng });
        setActiveDestination({
          name: result.title,
          addressText: geocodeRes.formattedAddress || result.fullAddress,
          lat: geocodeRes.lat,
          lng: geocodeRes.lng
        });
      }

      if (mapRef.current) {
        mapRef.current.setView([geocodeRes.lat, geocodeRes.lng], 18);
      }

      setAutoFollow(false);
      triggerAutoRecenterTimer();
      setSearchQuery('');
      setIsSearchFocused(false);
    } else {
      setNotFoundAlert("Local não geocodificado. Posicione o pino manualmente no mapa.");
      handleEnablePinAdjustment();
    }
  };

  const handleEnablePinAdjustment = () => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      setTempAdjustedCoords({ lat: center.lat, lng: center.lng });
    }
    setIsPinAdjustmentMode(true);
    setAutoFollow(false);
    setIsSearchFocused(false);
  };

  const handleConfirmPinAdjustment = () => {
    if (tempAdjustedCoords) {
      setPendingConfirmation({
        name: 'Local Confirmado Manualmente',
        addressText: `Coordenadas: ${tempAdjustedCoords.lat.toFixed(5)}, ${tempAdjustedCoords.lng.toFixed(5)}`,
        lat: tempAdjustedCoords.lat,
        lng: tempAdjustedCoords.lng,
        exactNumberMatched: true,
        exactStreetMatched: true,
        locationType: 'ROOFTOP'
      });
    }
    setIsPinAdjustmentMode(false);
  };

  const handleSearchInput = async (value: string) => {
    setSearchQuery(value);
    setNotFoundAlert(null);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const rawText = value.trim();

    if (rawText.length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const suggestions = await fetchAutocompleteSuggestions(rawText, activePos);
          setSearchResults(suggestions);
        } catch (err) {
          console.warn('Erro no Autocomplete:', err);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleRemoveWaypoint = (id: string) => {
    lastFetchedRouteKeyRef.current = '';
    setWaypoints(prev => prev.filter(w => w.id !== id));
  };

  const handleSelectRouteFromHistory = (item: RouteHistoryItem) => {
    setShowRouteHistoryModal(false);
    setIsSearchFocused(false);
    setActiveDestination({
      name: item.destinationName,
      addressText: item.destinationAddress,
      lat: item.destinationLat,
      lng: item.destinationLng
    });

    if (item.destinationLat && item.destinationLng) {
      setDestCoords({ lat: item.destinationLat, lng: item.destinationLng });
    }

    lastFetchedRouteKeyRef.current = '';
    setOptimizationMessage(`📍 Rota recarregada do histórico: ${item.destinationName}`);
    speakInstruction(`Rota recarregada para ${item.destinationName}`);
    setTimeout(() => setOptimizationMessage(null), 4000);
  };

  const activeStepInstruction = activeDestination ? `Siga para ${activeDestination.name}` : 'Pesquise o endereço ou escolha dos recentes...';

  const calculatedProgressPercent = () => {
    if (!initialRouteDistance || !routeDetails) return 0;
    const remaining = routeDetails.distanceMeters;
    const progress = ((initialRouteDistance - remaining) / initialRouteDistance) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
  };

  const currentSpeed = activePos ? activePos.speedKmh : 0;

  return (
    <div 
      ref={outerContainerRef}
      className={`flex flex-col bg-slate-950 text-white shadow-2xl transition-all duration-200 font-sans relative overflow-hidden select-none touch-none ${
        isFullscreen 
          ? 'fixed inset-0 top-0 left-0 z-[9999] w-full h-[100dvh] rounded-none border-none max-w-none max-h-none' 
          : isExpanded
          ? 'relative h-[82vh] min-h-[580px] sm:h-[780px] w-full rounded-2xl border border-indigo-500/50 shadow-2xl'
          : 'relative h-[calc(100dvh-130px)] min-h-[460px] sm:h-[680px] w-full rounded-2xl border border-slate-800'
      }`}
    >
      <div className="bg-[#137333] text-white px-2.5 py-1.5 z-30 shadow-md flex items-center justify-between relative border-b border-emerald-800 flex-shrink-0">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <div className="p-1.5 bg-black/20 rounded-lg text-white flex-shrink-0 border border-white/20">
            <ArrowUp className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="bg-emerald-950/80 text-emerald-300 text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full tracking-wider flex items-center gap-0.5">
                <Bike className="h-2.5 w-2.5 text-emerald-400" />
                Google GPS (Menor Percurso)
              </span>
              {waypoints.length > 0 && (
                <span className="bg-purple-900/90 text-purple-200 text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5 text-amber-300" />
                  {waypoints.length} Parada(s)
                </span>
              )}
            </div>
            <h2 className="text-xs font-extrabold truncate leading-tight mt-0.5">
              {activeStepInstruction}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-0.5 flex-shrink-0 pl-1">
          <button
            onClick={() => setShowRouteHistoryModal(true)}
            className="p-1.5 rounded-lg transition-colors bg-indigo-900 text-indigo-100 hover:bg-indigo-800 flex items-center gap-1 text-[11px] font-bold"
            title="Histórico de Rotas"
          >
            <History className="h-3.5 w-3.5 text-indigo-300" />
          </button>

          <button
            onClick={() => setNightMode(!nightMode)}
            className={`p-1.5 rounded-lg transition-colors ${
              nightMode ? 'bg-amber-500 text-slate-950' : 'bg-emerald-900 text-emerald-200 hover:bg-emerald-800'
            }`}
            title="Alternar Modo Noturno"
          >
            {nightMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => setShowWaypointsList(!showWaypointsList)}
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold ${
              waypoints.length > 0 ? 'bg-purple-600 text-white' : 'bg-emerald-900 text-emerald-200 hover:bg-emerald-800'
            }`}
            title="Paradas da Rota"
          >
            <ListPlus className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={handleEnablePinAdjustment}
            className={`p-1.5 rounded-lg transition-colors ${
              isPinAdjustmentMode ? 'bg-amber-500 text-slate-950' : 'bg-emerald-900 text-emerald-200 hover:bg-emerald-800'
            }`}
            title="Ajustar Ponto no Mapa"
          >
            <Hand className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-1.5 rounded-lg transition-colors ${
              voiceEnabled ? 'bg-emerald-600 text-white' : 'bg-emerald-950 text-emerald-400'
            }`}
          >
            {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-1.5 rounded-lg transition-colors text-emerald-100 ${
              isExpanded ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'
            }`}
            title={isExpanded ? "Restaurar Proporção" : "Expandir Proporcionalmente"}
          >
            <Expand className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-emerald-100"
            title={isFullscreen ? "Restaurar" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {onClose && (
            <button onClick={onClose} className="p-1.5 hover:bg-red-500/20 text-red-200 rounded-lg">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {isNavigating && currentNextTarget && (
        <div className="bg-indigo-950 border-b border-indigo-500/40 px-3 py-2 z-30 flex items-center justify-between text-white shadow-lg flex-shrink-0 animate-fadeIn">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <div className="p-2 bg-indigo-600 text-white rounded-xl flex-shrink-0 shadow-sm animate-pulse">
              <Navigation2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-black uppercase px-2 py-0.2 rounded-full tracking-wider ${
                  currentNextTarget.isWaypoint ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'
                }`}>
                  {currentNextTarget.isWaypoint ? 'Próxima Parada' : 'Destino Final'}
                </span>
                {distToNextTargetMeters !== null && (
                  <span className="text-[10px] font-black text-amber-300 bg-amber-950/80 px-2 py-0.2 rounded-full border border-amber-500/30">
                    A {distToNextTargetMeters > 1000 ? `${(distToNextTargetMeters/1000).toFixed(1)} km` : `${distToNextTargetMeters} metros`}
                  </span>
                )}
              </div>
              <p className="text-xs font-black text-white truncate mt-0.5 leading-snug">
                {currentNextTarget.name}
              </p>
              <p className="text-[10px] text-slate-300 truncate opacity-90">
                {currentNextTarget.addressText}
              </p>
            </div>
          </div>
        </div>
      )}

      {routeDetails && isNavigating && (
        <div className="w-full bg-slate-900 h-1 z-30">
          <div 
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${calculatedProgressPercent()}%` }}
          />
        </div>
      )}

      {optimizationMessage && (
        <div className="bg-purple-600 text-white px-2.5 py-1.5 z-40 flex items-center justify-between text-[11px] font-bold shadow-md animate-bounce-short">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-300 flex-shrink-0" />
            <span>{optimizationMessage}</span>
          </div>
          <button onClick={() => setOptimizationMessage(null)} className="p-0.5 hover:bg-black/10 rounded">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {showRouteHistoryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[10000]">
          <div className="bg-slate-900 text-white rounded-2xl max-w-md w-full p-5 space-y-4 border border-indigo-500/40 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <History className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Histórico de Rotas Navegadas</h3>
                  <p className="text-[10px] text-slate-400">Suas últimas rotas percorridas</p>
                </div>
              </div>
              <button onClick={() => setShowRouteHistoryModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
              {routeHistoryList.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <History className="h-10 w-10 mx-auto mb-2 text-slate-600" />
                  Nenhuma rota gravada no histórico até o momento.
                </div>
              ) : (
                routeHistoryList.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleSelectRouteFromHistory(item)}
                    className="p-3 bg-slate-800 hover:bg-slate-700/80 rounded-xl border border-slate-700/60 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                        <p className="text-xs font-extrabold text-white truncate">{item.destinationName}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{item.destinationAddress}</p>
                      <div className="flex items-center gap-2 text-[9px] text-indigo-300 font-medium pt-0.5">
                        <span>{item.date} às {item.time}</span>
                        <span>•</span>
                        <span>{(item.distanceMeters / 1000).toFixed(1)} km</span>
                        <span>•</span>
                        <span>{Math.ceil(item.durationSeconds / 60)} min</span>
                        {item.waypointsCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400 font-bold">{item.waypointsCount} parada(s)</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button 
                      className="p-2 bg-indigo-600 group-hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex-shrink-0 flex items-center gap-1"
                      title="Refazer Rota"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Refazer</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowRouteHistoryModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showWaypointsList && (
        <div className="bg-slate-900 border-b border-purple-500/40 p-2 z-40 relative space-y-2 flex-shrink-0 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Flag className="h-3 w-3" />
              Paradas ({waypoints.length})
            </h4>
            <div className="flex items-center space-x-1">
              {(waypoints.length > 0 || destCoords) && (
                <button
                  onClick={handleOptimizeWaypointsSequence}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-0.5 shadow"
                  title="Reordenar para o Menor Percurso"
                >
                  <Sparkles className="h-2.5 w-2.5 text-amber-300" />
                  <span>Otimizar Menor Percurso</span>
                </button>
              )}
              <button onClick={() => setShowWaypointsList(false)} className="text-slate-400 hover:text-white p-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {waypoints.length === 0 ? (
            <p className="text-[10px] text-slate-400">Nenhuma parada intermediária adicionada.</p>
          ) : (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {waypoints.map((wp, idx) => (
                <div key={wp.id} className="bg-slate-800 border border-slate-700 rounded-lg p-1.5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white font-black text-[9px] flex items-center justify-center flex-shrink-0">
                      P{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate text-[10px]">{wp.name}</p>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveWaypoint(wp.id)} className="text-red-400 p-0.5">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {routeErrorAlert && (
        <div className="bg-red-600 text-white px-2.5 py-1 z-40 flex items-center justify-between text-[11px] font-bold shadow-md">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>⚠️ {routeErrorAlert}</span>
          </div>
          <button onClick={() => setRouteErrorAlert(null)} className="p-0.5">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {notFoundAlert && (
        <div className="bg-amber-500 text-slate-950 px-2.5 py-1 z-40 flex items-center justify-between text-[11px] font-bold shadow-md">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{notFoundAlert}</span>
          </div>
          <button onClick={() => setNotFoundAlert(null)} className="p-0.5">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {isPinAdjustmentMode && (
        <div className="bg-amber-500 text-slate-950 px-2.5 py-1 z-40 flex items-center justify-between font-bold text-[11px] shadow-lg">
          <div className="flex items-center gap-1">
            <Hand className="h-3.5 w-3.5 text-slate-950 animate-bounce" />
            <span>Arraste o mapa até o imóvel</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsPinAdjustmentMode(false)} className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px]">
              Sair
            </button>
            <button onClick={handleConfirmPinAdjustment} className="bg-emerald-700 text-white px-2.5 py-0.5 rounded text-[10px] font-black">
              Confirmar
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border-b border-slate-800 px-2 py-1.5 z-[100] relative flex-shrink-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <form onSubmit={(e) => handleExecuteDirectSearch(e, false)} className="relative flex-1 flex items-center">
            <input
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              data-lpignore="true"
              placeholder="Pesquise aqui..."
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="w-full text-white placeholder-slate-400 text-xs pl-7 pr-12 py-1.5 rounded-lg border bg-slate-800 border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 pointer-events-none" />

            <button
              type="button"
              onClick={handleStartVoiceRecognition}
              className={`absolute right-6 p-0.5 rounded transition-colors ${
                isListeningVoice ? 'bg-red-600 text-white animate-pulse' : 'text-slate-400 hover:text-white'
              }`}
              title="Pesquisa por Voz"
            >
              {isListeningVoice ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>

            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="text-slate-400 hover:text-white absolute right-1 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        </div>

        {isSearching && searchResults.length === 0 && (
          <div className="absolute left-2 right-2 top-full mt-0.5 bg-slate-900 border border-slate-700 rounded-lg p-2 z-[110] shadow-2xl flex items-center justify-center gap-1.5 text-xs text-blue-400 font-bold">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Buscando endereço...</span>
          </div>
        )}

        {isSearchFocused && searchResults.length === 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl z-[120] overflow-hidden max-h-[70vh] overflow-y-auto p-3 space-y-3 font-sans border-t-2 border-t-blue-500">
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
              <button
                type="button"
                onClick={() => setShowRouteHistoryModal(true)}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full px-3 py-1.5 text-xs text-slate-200 font-medium whitespace-nowrap flex-shrink-0"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <History className="h-3 w-3" />
                </div>
                <span>Histórico de Rotas</span>
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 py-1 font-semibold">
                <span className="text-slate-200 font-bold text-sm">Recentes</span>
                <Info className="h-3.5 w-3.5 text-slate-500" />
              </div>

              {recentSearches.length === 0 ? (
                <p className="text-xs text-slate-500 px-1 py-2">Nenhum endereço pesquisado recentemente.</p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {recentSearches.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectRecentItem(item, false)}
                      className="py-2.5 px-1 hover:bg-slate-800/80 rounded-xl cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-colors">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-100 truncate leading-snug">{item.title}</p>
                          <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{item.subtitle || item.fullAddress}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 flex-shrink-0 pl-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRecentItem(item, true);
                          }}
                          className="p-1.5 text-purple-400 hover:bg-purple-950/50 rounded-lg text-[10px] font-bold flex items-center gap-0.5"
                          title="Adicionar como Parada"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSearchFocused(false)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1 font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="absolute left-2 right-2 top-full mt-0.5 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl z-[130] overflow-hidden divide-y divide-slate-800 max-h-56 overflow-y-auto">
            {searchResults.map((res) => (
              <div 
                key={res.id} 
                className="p-2.5 hover:bg-blue-950/80 transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div 
                  onClick={() => handleSelectSearchResult(res, false)}
                  className="flex items-center space-x-2.5 min-w-0 flex-1 pr-1.5"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{res.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">{res.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSearchResult(res, true);
                    }}
                    className="text-[9px] bg-purple-600/30 hover:bg-purple-600 text-purple-200 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    <span>Parada</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectSearchResult(res, false)}
                    className="text-[9px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded hover:bg-blue-700"
                  >
                    Ir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative flex-1 min-h-0 w-full h-full overflow-hidden touch-none select-none"
      >
        <div 
          style={{ 
            transform: `rotate(${rotationAngle}deg)`, 
            transformOrigin: 'center center',
            width: '400%', // Aumentado de 350% para 400% para cobrir as bordas ao rotacionar
            height: '400%', // Aumentado de 350% para 400%
            position: 'absolute',
            top: '-150%', // Ajustado de -125% para -150% para manter centralizado
            left: '-150%', // Ajustado de -125% para -150%
            transition: touchStartAngleRef.current ? 'none' : 'transform 0.3s ease-out'
          }}
        >
          <div ref={mapContainerRef} className="w-full h-full bg-slate-950 touch-none" />
        </div>

        <div className="absolute bottom-3 left-2.5 z-20 flex flex-col items-center">
          <div className={`p-2 rounded-xl shadow-2xl border-2 flex flex-col items-center justify-center transition-all ${
            currentSpeed > 70 
              ? 'bg-red-600 text-white border-red-400 animate-pulse' 
              : currentSpeed > 50 
              ? 'bg-amber-500 text-slate-950 border-amber-300' 
              : 'bg-slate-900/90 text-white border-slate-700'
          }`}>
            <span className="text-base font-black leading-none font-mono">{currentSpeed}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5 opacity-80">km/h</span>
          </div>
        </div>

        {isPinAdjustmentMode && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
            <div className="relative flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-amber-400 rounded-full animate-ping absolute" />
              <div className="p-2 bg-red-600 text-white rounded-full shadow-2xl border-2 border-white z-10">
                <MapPin className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {pendingConfirmation && (
          <div className="absolute bottom-2 left-2 right-2 z-40 bg-slate-900 border-2 border-amber-500 rounded-xl p-2.5 shadow-2xl space-y-2 animate-bounce-short">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-1.5 min-w-0">
                <div className="p-1 bg-amber-500 text-slate-950 rounded-lg font-black flex-shrink-0">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{pendingConfirmation.name}</p>
                  <p className="text-[9px] text-slate-400 truncate">{pendingConfirmation.addressText}</p>
                </div>
              </div>

              <button onClick={() => setPendingConfirmation(null)} className="text-slate-400 p-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5 border-t border-slate-800">
              <button
                onClick={handleConfirmLocation}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold py-1.5 rounded-lg flex items-center justify-center gap-0.5"
              >
                <Check className="h-3 w-3" />
                <span>CONFIRMAR</span>
              </button>

              <button
                onClick={() => {
                  const targetLat = pendingConfirmation.lat;
                  const targetLng = pendingConfirmation.lng;
                  setPendingConfirmation(null);
                  if (mapRef.current) mapRef.current.setView([targetLat, targetLng], 18);
                  handleEnablePinAdjustment();
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-extrabold py-1.5 rounded-lg flex items-center justify-center gap-0.5"
              >
                <Hand className="h-3 w-3" />
                <span>AJUSTAR</span>
              </button>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-2.5 z-20 flex flex-col space-y-1.5 items-end">
          <button
            onClick={() => setShowRouteHistoryModal(true)}
            className="px-2.5 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-indigo-100 font-extrabold rounded-xl shadow-xl flex items-center gap-1.5 text-xs transition-all border border-indigo-500/40"
            title="Abrir Histórico de Rotas"
          >
            <History className="h-3.5 w-3.5 text-indigo-300" />
            <span>Histórico</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-2.5 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 text-xs font-black transition-all ${
              isExpanded 
                ? 'bg-indigo-600 text-white border border-indigo-400' 
                : 'bg-slate-900/90 text-indigo-300 border border-indigo-500/40'
            }`}
            title="Expandir Proporcionalmente"
          >
            <Expand className="h-3.5 w-3.5" />
            <span>{isExpanded ? 'Restaurar' : 'Expandir'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className={`px-2.5 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 text-xs font-black transition-all ${
              isFullscreen 
                ? 'bg-amber-500 text-slate-950 border border-amber-300' 
                : 'bg-emerald-600 text-white border border-emerald-400 animate-pulse'
            }`}
            title="Expandir Tela Cheia Imersiva"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}</span>
          </button>

          {rotationAngle !== 0 && (
            <button
              onClick={handleResetToNorth}
              className="p-2 bg-slate-900/90 text-emerald-400 border border-emerald-500/50 rounded-xl shadow-xl flex items-center justify-center"
              title="Voltar ao Norte"
            >
              <div style={{ transform: `rotate(${-rotationAngle}deg)` }}>
                <Compass className="h-5 w-5 text-emerald-400" />
              </div>
            </button>
          )}

          {(!autoFollow || !headsUpMode) && (
            <button 
              onClick={handleRecenter} 
              className="px-2.5 py-1.5 bg-emerald-500 text-slate-950 font-black rounded-xl shadow-xl flex items-center gap-1 text-[11px] animate-bounce"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              <span>
                {autoRecenterCountdown !== null ? `Centralizar (${autoRecenterCountdown}s)` : 'Acompanhar'}
              </span>
            </button>
          )}

          <button onClick={handleRecenter} className="p-2 bg-blue-600 text-white rounded-xl shadow-lg">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border-t border-slate-800 px-3 py-2 z-30 flex-shrink-0 shadow-2xl pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex-shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 flex-wrap leading-tight">
                <span className="text-sm sm:text-base font-black text-emerald-400">
                  {routeDetails && isNavigating ? `${Math.ceil(routeDetails.durationSeconds / 60)} min` : '--'}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  ({routeDetails && isNavigating ? `${(routeDetails.distanceMeters / 1000).toFixed(1)} km` : '--'})
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                Chegada: <strong className="text-white font-bold">{isNavigating && routeDetails?.etaTimeString ? routeDetails.etaTimeString : '--:--'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (!isNavigating && !destCoords) {
                alert("Escolha um endereço ou destino antes de iniciar a navegação.");
                return;
              }
              const nextState = !isNavigating;
              
              if (nextState) {
                handleOptimizeWaypointsSequence();
              }

              setIsNavigating(nextState);
              gpsTracker.setNavigating(nextState);
              if (nextState) {
                handleRecenter();
              }
            }}
            className={`px-3.5 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-lg transition-all active:scale-95 flex-shrink-0 ${
              isNavigating ? 'bg-red-600 text-white animate-pulse' : 'bg-[#1a73e8] text-white'
            }`}
          >
            {isNavigating ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>{isNavigating ? 'ENCERRAR' : 'NAVEGAR'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}