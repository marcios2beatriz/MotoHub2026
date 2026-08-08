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

// Algoritmo de Otimização 2-Opt para TSP (Garante o menor percurso acumulado sem cruzamentos)
function runTwoOptOptimization<T extends { lat: number; lng: number }>(
  origin: { lat: number; lng: number },
  initialTour: T[]
): T[] {
  if (initialTour.length <= 2) return initialTour;

  let tour = [...initialTour];
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  const calculateTotalDist = (points: T[]) => {
    let d = haversineMeters(origin.lat, origin.lng, points[0].lat, points[0].lng);
    for (let i = 0; i < points.length - 1; i++) {
      d += haversineMeters(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
    }
    return d;
  };

  let bestDist = calculateTotalDist(tour);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < tour.length - 1; i++) {
      for (let k = i + 1; k < tour.length; k++) {
        // Inverte o trecho entre i e k
        const newTour = [
          ...tour.slice(0, i),
          ...tour.slice(i, k + 1).reverse(),
          ...tour.slice(k + 1)
        ];

        const newDist = calculateTotalDist(newTour);
        if (newDist < bestDist - 1) { // 1 metro de melhoria mínima
          bestDist = newDist;
          tour = newTour;
          improved = true;
        }
      }
    }
  }

  return tour;
}

// Algoritmo para Reordenar TODOS os pontos (do mais perto ao mais longe, otimizando o MENOR PERCURSO)
export function optimizeAllPointsSequence<T extends { lat: number; lng: number }>(
  origin: { lat: number; lng: number },
  allPoints: T[]
): T[] {
  if (allPoints.length <= 1) return [...allPoints];

  // 1. Vizinho mais próximo inicial
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

  // 2. Refinamento 2-Opt para garantir a rota de menor distância
  return runTwoOptOptimization(origin, ordered);
}

export function optimizeDeliverySequence(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints: RouteWaypoint[]
): number[] {
  if (waypoints.length <= 1) return waypoints.map((_, i) => i);

  const optimizedWaypoints = optimizeAllPointsSequence(origin, waypoints);
  
  // Mapeia os índices originais
  const resultIndices: number[] = [];
  optimizedWaypoints.forEach(optWp => {
    const originalIdx = waypoints.findIndex(w => w.lat === optWp.lat && w.lng === optWp.lng);
    if (originalIdx !== -1 && !resultIndices.includes(originalIdx)) {
      resultIndices.push(originalIdx);
    }
  });

  return resultIndices;
}

export async function computeRoute({ 
  origin, 
  destination, 
  waypoints = [], 
  travelMode = 'TWO_WHEELER',
  optimizeWaypoints = true 
}: RouteRequestParams): Promise<RouteResult> {
  const apiKey = getGoogleMapsApiKey();

  // ETAPA 1: Google Directions Service via JS SDK (analisa todas as opções e seleciona a rota de Menor Percurso)
  try {
    await loadGoogleMapsSDK();

    if ((window as any).google?.maps?.DirectionsService) {
      const directionsService = new (window as any).google.maps.DirectionsService();
      const mode = (window as any).google.maps.TravelMode.TWO_WHEELER || (window as any).google.maps.TravelMode.DRIVING;

      const formattedWaypoints = waypoints.map(w => ({
        location: new (window as any).google.maps.LatLng(w.lat, w.lng),
        stopover: true
      }));

      const request = {
        origin: new (window as any).google.maps.LatLng(origin.lat, origin.lng),
        destination: new (window as any).google.maps.LatLng(destination.lat, destination.lng),
        waypoints: formattedWaypoints,
        optimizeWaypoints: optimizeWaypoints && waypoints.length > 0,
        provideRouteAlternatives: true, // Força a retornar rotas alternativas para escolher a de MENOR PERCURSO
        travelMode: mode
      };

      const result = await new Promise<any>((resolve, reject) => {
        directionsService.route(request, (response: any, status: string) => {
          if (status === 'OK' && response && response.routes && response.routes.length > 0) {
            resolve(response);
          } else {
            reject(new Error(`DirectionsService status: ${status}`));
          }
        });
      });

      // Avalia todas as rotas candidatas e seleciona a de MENOR DISTÂNCIA (Menor Percurso)
      let shortestRoute = result.routes[0];
      let minTotalDistance = Infinity;

      result.routes.forEach((candRoute: any) => {
        let routeDist = 0;
        candRoute.legs.forEach((leg: any) => {
          routeDist += leg?.distance?.value || 0;
        });
        if (routeDist < minTotalDistance && routeDist > 0) {
          minTotalDistance = routeDist;
          shortestRoute = candRoute;
        }
      });

      let distanceMeters = 0;
      let durationSeconds = 0;
      const coordinates: [number, number][] = [];

      shortestRoute.legs.forEach((leg: any) => {
        distanceMeters += leg?.distance?.value || 0;
        durationSeconds += leg?.duration?.value || 0;
        if (leg.steps) {
          leg.steps.forEach((step: any) => {
            if (step.path) {
              step.path.forEach((p: any) => {
                coordinates.push([p.lat(), p.lng()]);
              });
            }
          });
        }
      });

      if (coordinates.length === 0 && shortestRoute.overview_path) {
        shortestRoute.overview_path.forEach((p: any) => coordinates.push([p.lat(), p.lng()]));
      }

      const durationMinutes = Math.ceil(durationSeconds / 60);
      const etaDate = new Date(Date.now() + durationMinutes * 60000);
      const etaTimeString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return {
        distanceMeters,
        durationSeconds,
        coordinates,
        travelModeUsed: 'GOOGLE_JS_SDK_DIRECTIONS',
        isFallback: false,
        etaTimeString,
        waypointOrder: shortestRoute.waypoint_order || waypoints.map((_, i) => i)
      };
    }
  } catch (err) {
    console.warn('Erro ao calcular rota via Google Directions JS SDK:', err);
  }

  // ETAPA 2: Fallback com Otimização Algorítmica 2-Opt Local
  const optimizedOrder = optimizeWaypoints ? optimizeDeliverySequence(origin, destination, waypoints) : waypoints.map((_, i) => i);
  const orderedWaypoints = optimizedOrder.map(i => waypoints[i]);

  if (apiKey) {
    try {
      const url = 'https://routes.googleapis.com/v1/directions:computeRoutes';

      const requestBody: any = {
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng
            }
          }
        },
        intermediates: orderedWaypoints.map(w => ({
          location: { latLng: { latitude: w.lat, longitude: w.lng } }
        })),
        travelMode: travelMode,
        routingPreference: 'SHORTEST_PATH', // Prioriza estritamente o MENOR PERCURSO na API Routes V2
        polylineQuality: 'HIGH_QUALITY',
        polylineEncoding: 'ENCODED_POLYLINE'
      };

      if (origin.heading !== undefined && origin.heading >= 0 && origin.heading <= 360) {
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
        const encodedPolyline = route.polyline?.encodedPolyline || '';
        const coordinates = decodePolyline(encodedPolyline);

        const distanceMeters = route.distanceMeters || 0;
        const durationSeconds = parseInt((route.duration || '0s').replace('s', ''), 10) || 0;

        const durationMinutes = Math.ceil(durationSeconds / 60);
        const etaDate = new Date(Date.now() + durationMinutes * 60000);
        const etaTimeString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return {
          distanceMeters,
          durationSeconds,
          coordinates,
          travelModeUsed: 'GOOGLE_ROUTES_V2_SHORTEST',
          isFallback: false,
          etaTimeString,
          waypointOrder: optimizedOrder
        };
      }
    } catch (err) {
      console.warn('Erro ao chamar Google Routes API v2 REST:', err);
    }
  }

  // Linha de emergência
  const lineCoords: [number, number][] = [[origin.lat, origin.lng]];
  orderedWaypoints.forEach(w => lineCoords.push([w.lat, w.lng]));
  lineCoords.push([destination.lat, destination.lng]);

  let fallbackDist = 0;
  for (let i = 0; i < lineCoords.length - 1; i++) {
    fallbackDist += haversineMeters(lineCoords[i][0], lineCoords[i][1], lineCoords[i+1][0], lineCoords[i+1][1]);
  }
  
  return {
    distanceMeters: Math.round(fallbackDist),
    durationSeconds: Math.round((fallbackDist / 1000) * 120), // est. ~30km/h
    coordinates: lineCoords,
    travelModeUsed: 'STRAIGHT_LINE_2OPT_FALLBACK',
    isFallback: true,
    fallbackReason: 'Erro ao conectar à API do Google Maps.',
    etaTimeString: new Date(Date.now() + Math.round((fallbackDist / 1000) * 120) * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    waypointOrder: optimizedOrder
  };
}