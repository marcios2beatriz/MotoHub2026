"use client";

import { loadGoogleMapsSDK, getGoogleMapsApiKey } from './googleMapsLoader';

export interface RouteWaypoint {
  lat: number;
  lng: number;
  name?: string;
  addressText?: string;
}

export interface RouteRequestParams {
  origin: { lat: number; lng: number; heading?: number };
  destination: { lat: number; lng: number };
  waypoints?: RouteWaypoint[];
  travelMode?: 'TWO_WHEELER' | 'DRIVE';
  optimizeWaypoints?: boolean;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lat, lng]
  travelModeUsed: string;
  isFallback: boolean;
  fallbackReason?: string;
  etaTimeString: string;
  waypointOrder?: number[];
}

export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function optimizeAllPointsSequence<T extends { lat: number; lng: number }>(
  origin: { lat: number; lng: number },
  allPoints: T[]
): T[] {
  if (allPoints.length <= 1) return [...allPoints];

  const unvisited = [...allPoints];
  const ordered: T[] = [];
  let currentLoc = origin;

  while (unvisited.length > 0) {
    let nearestIdx = -1;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = haversineMeters(currentLoc.lat, currentLoc.lng, unvisited[i].lat, unvisited[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx !== -1) {
      const selected = unvisited.splice(nearestIdx, 1)[0];
      ordered.push(selected);
      currentLoc = { lat: selected.lat, lng: selected.lng };
    }
  }

  return ordered;
}

export async function computeRoute({ 
  origin, 
  destination, 
  waypoints = [], 
  travelMode = 'TWO_WHEELER',
  optimizeWaypoints = false 
}: RouteRequestParams): Promise<RouteResult> {
  const apiKey = getGoogleMapsApiKey();

  // Priorizamos a API de Rotas V2 (REST) por ser mais moderna e permitir SHORTEST_PATH nativo
  if (apiKey) {
    try {
      const url = 'https://routes.googleapis.com/v1/directions:computeRoutes';

      const requestBody: any = {
        origin: {
          location: {
            latLng: { latitude: origin.lat, longitude: origin.lng }
          }
        },
        destination: {
          location: {
            latLng: { latitude: destination.lat, longitude: destination.lng }
          }
        },
        intermediates: waypoints.map(w => ({
          location: { latLng: { latitude: w.lat, longitude: w.lng } }
        })),
        travelMode: travelMode,
        routingPreference: 'SHORTEST_PATH', // ESSENCIAL: Garante o trajeto mais curto
        polylineQuality: 'HIGH_QUALITY',
        polylineEncoding: 'ENCODED_POLYLINE',
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: false,
          avoidFerries: true
        }
      };

      // Se estiver em movimento, informa o heading para evitar retornos forçados (U-turns)
      if (origin.heading !== undefined && origin.heading >= 0) {
        requestBody.origin.heading = Math.round(origin.heading);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = decodePolyline(route.polyline?.encodedPolyline || '');
        const durationSeconds = parseInt((route.duration || '0s').replace('s', ''), 10) || 0;

        return {
          distanceMeters: route.distanceMeters || 0,
          durationSeconds,
          coordinates,
          travelModeUsed: 'GOOGLE_ROUTES_V2_SHORTEST',
          isFallback: false,
          etaTimeString: new Date(Date.now() + durationSeconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          waypointOrder: waypoints.map((_, i) => i)
        };
      }
    } catch (err) {
      console.warn('Erro na Routes API V2, tentando SDK legado...', err);
    }
  }

  // Fallback para Directions Service Legado
  try {
    await loadGoogleMapsSDK();
    if ((window as any).google?.maps?.DirectionsService) {
      const directionsService = new (window as any).google.maps.DirectionsService();
      
      const request = {
        origin: new (window as any).google.maps.LatLng(origin.lat, origin.lng),
        destination: new (window as any).google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypoints.map(w => ({ location: new (window as any).google.maps.LatLng(w.lat, w.lng), stopover: true })),
        optimizeWaypoints,
        travelMode: (window as any).google.maps.TravelMode.TWO_WHEELER,
        unitSystem: (window as any).google.maps.UnitSystem.METRIC
      };

      const result = await new Promise<any>((resolve, reject) => {
        directionsService.route(request, (response: any, status: string) => {
          if (status === 'OK' && response?.routes?.[0]) resolve(response);
          else reject(new Error(status));
        });
      });

      const route = result.routes[0];
      const coords: [number, number][] = [];
      let dist = 0;
      let dur = 0;

      route.legs.forEach((leg: any) => {
        dist += leg.distance.value;
        dur += leg.duration.value;
        leg.steps.forEach((step: any) => {
          step.path.forEach((p: any) => coords.push([p.lat(), p.lng()]));
        });
      });

      return {
        distanceMeters: dist,
        durationSeconds: dur,
        coordinates: coords,
        travelModeUsed: 'GOOGLE_SDK_FALLBACK',
        isFallback: false,
        etaTimeString: new Date(Date.now() + dur * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
    }
  } catch (e) {}

  return {
    distanceMeters: 0,
    durationSeconds: 0,
    coordinates: [[origin.lat, origin.lng], [destination.lat, destination.lng]],
    travelModeUsed: 'ERROR_FALLBACK',
    isFallback: true,
    etaTimeString: '--:--'
  };
}