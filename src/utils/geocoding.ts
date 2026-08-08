"use client";

import { loadGoogleMapsSDK } from './googleMapsLoader';

export interface ParsedAddressQuery {
  rawQuery: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cleanedQuery: string;
}

export interface GeocodedAddress {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
  isApproximate: boolean;
  locationType?: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
  requestedNumber?: string | null;
  matchedNumber?: string | null;
  exactNumberMatched: boolean;
  exactStreetMatched: boolean;
  streetMismatchReason?: string;
  unconfirmedReason?: string;
  source: string;
  addressComponents?: {
    streetNumber?: string;
    route?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

export interface AutocompleteSuggestion {
  id: string;
  title: string;
  subtitle: string;
  fullAddress: string;
  placeId?: string;
  lat?: number;
  lng?: number;
}

// Limpa conectivos da linguagem natural em português
function cleanNaturalPortugueseAddress(raw: string): string {
  return raw
    .replace(/\b(no|do|da|de)\s+bairro\s+(dos?|das?|de|do|da)?\b/gi, ', ')
    .replace(/\bbairro\b/gi, ', ')
    .replace(/\b(em|na|no)\s+(cidade\s+de\s+)?campina\s+grande(\s*-\s*pb|\s+pb)?/gi, ', Campina Grande, PB')
    .replace(/\bcampina\s+grande(\s*-\s*pb|\s+pb)?/gi, ', Campina Grande, PB')
    .replace(/\s+/g, ' ')
    .trim();
}

// 1. PARSER ESTRUTURADO DE ENDEREÇO
export function parseAddressQuery(rawQuery: string): ParsedAddressQuery {
  if (!rawQuery || !rawQuery.trim()) {
    return { rawQuery: '', cleanedQuery: '', street: null, number: null, neighborhood: null, city: null, state: null };
  }

  const cleanedQuery = cleanNaturalPortugueseAddress(rawQuery);

  let number: string | null = null;
  const numberMatch = cleanedQuery.match(/(?:n[ºº°]\s*|,\s*|\s+)(\d{1,5})(?:\s*[,-]|\s+|$)/i);
  if (numberMatch && numberMatch[1]) {
    number = numberMatch[1].trim();
  }

  const parts = cleanedQuery.split(',').map(p => p.trim()).filter(Boolean);

  let street: string | null = null;
  let neighborhood: string | null = null;
  let city: string | null = 'Campina Grande';
  let state: string | null = 'PB';

  if (parts.length >= 1) {
    let rawStreet = parts[0];
    if (number) {
      rawStreet = rawStreet.replace(new RegExp(`(?:n[ºº°]\\s*|,\\s*|\\s+)${number}(?:\\s*[,-]|\\s+|$)`, 'i'), '').trim();
    }
    street = rawStreet || parts[0];
  }

  if (parts.length >= 2) {
    if (!parts[1].match(/^(campina grande|pb|paraiba)$/i) && !parts[1].match(/^\d{1,5}$/)) {
      neighborhood = parts[1];
    }
  }

  return {
    rawQuery,
    cleanedQuery,
    street,
    number,
    neighborhood,
    city,
    state
  };
}

export function parseAddressComponents(components: any[] = []) {
  const result = {
    streetNumber: '',
    route: '',
    neighborhood: '',
    city: '',
    state: '',
    postalCode: ''
  };

  if (!Array.isArray(components)) return result;

  components.forEach(comp => {
    const types: string[] = comp.types || [];
    if (types.includes('street_number')) {
      result.streetNumber = comp.long_name || comp.short_name || '';
    } else if (types.includes('route')) {
      result.route = comp.long_name || comp.short_name || '';
    } else if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood')) {
      result.neighborhood = comp.long_name || comp.short_name || '';
    } else if (types.includes('locality') || types.includes('administrative_area_level_2')) {
      result.city = comp.long_name || comp.short_name || '';
    } else if (types.includes('administrative_area_level_1')) {
      result.state = comp.short_name || comp.long_name || '';
    } else if (types.includes('postal_code')) {
      result.postalCode = comp.long_name || comp.short_name || '';
    }
  });

  return result;
}

// 2. AUTOCOMPLETE OFICIAL DO GOOGLE PLACES COM FALLBACK
export async function fetchAutocompleteSuggestions(
  input: string,
  userLocation?: { lat: number; lng: number } | null
): Promise<AutocompleteSuggestion[]> {
  const rawText = input.trim();
  if (!rawText || rawText.length < 2) return [];

  const suggestions: AutocompleteSuggestion[] = [];
  const seenTitles = new Set<string>();

  const centerLat = userLocation?.lat || -7.2247;
  const centerLng = userLocation?.lng || -35.8878;

  // FONTE 1: Google Places Autocomplete Service (Oficial Google Maps SDK)
  try {
    await loadGoogleMapsSDK();

    if ((window as any).google?.maps?.places?.AutocompleteService) {
      const autocompleteService = new (window as any).google.maps.places.AutocompleteService();
      
      const queryWithCity = rawText.toLowerCase().includes('campina') ? rawText : `${rawText}, Campina Grande PB`;

      const predictions = await new Promise<any[]>((resolve) => {
        autocompleteService.getPlacePredictions({
          input: queryWithCity,
          componentRestrictions: { country: 'br' },
          locationBias: new (window as any).google.maps.Circle({
            center: { lat: centerLat, lng: centerLng },
            radius: 30000 // 30 km em volta de Campina Grande
          })
        }, (results: any[], status: string) => {
          if (status === 'OK' && results) {
            resolve(results);
          } else {
            resolve([]);
          }
        });
      });

      if (predictions && predictions.length > 0) {
        predictions.forEach((item: any) => {
          const mainText = item.structured_formatting?.main_text || item.description.split(',')[0];
          const secondaryText = item.structured_formatting?.secondary_text || item.description;

          const key = mainText.toLowerCase().trim();
          if (!seenTitles.has(key)) {
            seenTitles.add(key);
            suggestions.push({
              id: 'google_places_' + item.place_id,
              title: mainText,
              subtitle: secondaryText,
              fullAddress: item.description,
              placeId: item.place_id
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('Google Places Autocomplete Service indisponível:', err);
  }

  // FONTE 2: Fallback via Geocoder do Google caso Places precise de suporte
  if (suggestions.length === 0) {
    try {
      await loadGoogleMapsSDK();
      if ((window as any).google?.maps?.Geocoder) {
        const geocoder = new (window as any).google.maps.Geocoder();
        const bounds = new (window as any).google.maps.LatLngBounds(
          new (window as any).google.maps.LatLng(centerLat - 0.2, centerLng - 0.2),
          new (window as any).google.maps.LatLng(centerLat + 0.2, centerLng + 0.2)
        );

        const geocodeResults = await new Promise<any[]>((resolve) => {
          geocoder.geocode({
            address: `${rawText}, Campina Grande, PB, Brasil`,
            bounds,
            componentRestrictions: { country: 'BR' }
          }, (results: any[], status: string) => {
            if (status === 'OK' && results) resolve(results);
            else resolve([]);
          });
        });

        if (geocodeResults && geocodeResults.length > 0) {
          geocodeResults.forEach(item => {
            const comps = parseAddressComponents(item.address_components || []);
            const title = comps.route 
              ? `${comps.route}${comps.streetNumber ? ', ' + comps.streetNumber : ''}`
              : item.formatted_address.split(',')[0];

            const subtitle = `${comps.neighborhood ? comps.neighborhood + ', ' : ''}${comps.city || 'Campina Grande'} - ${comps.state || 'PB'}`;
            const lat = typeof item.geometry.location.lat === 'function' ? item.geometry.location.lat() : item.geometry.location.lat;
            const lng = typeof item.geometry.location.lng === 'function' ? item.geometry.location.lng() : item.geometry.location.lng;

            const key = title.toLowerCase().trim();
            if (!seenTitles.has(key)) {
              seenTitles.add(key);
              suggestions.push({
                id: 'geocoder_' + (item.place_id || Math.random().toString()),
                title,
                subtitle,
                fullAddress: item.formatted_address,
                placeId: item.place_id,
                lat,
                lng
              });
            }
          });
        }
      }
    } catch (e) {}
  }

  // FONTE 3: Fallback OpenStreetMap Nominatim
  if (suggestions.length === 0) {
    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${rawText}, Campina Grande, Paraiba, Brasil`)}&countrycodes=br&limit=5&addressdetails=1`;
      const res = await fetch(searchUrl, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
      if (res.ok) {
        const osmData = await res.json();
        if (Array.isArray(osmData) && osmData.length > 0) {
          osmData.forEach((item: any) => {
            const addr = item.address || {};
            const road = addr.road || addr.pedestrian || addr.footway || item.display_name.split(',')[0];
            const houseNumber = addr.house_number ? `, ${addr.house_number}` : '';
            const title = `${road}${houseNumber}`;
            const neighborhood = addr.suburb || addr.neighbourhood || addr.district || '';
            const subtitle = `${neighborhood ? neighborhood + ', ' : ''}Campina Grande - PB`;

            const key = title.toLowerCase().trim();
            if (!seenTitles.has(key)) {
              seenTitles.add(key);
              suggestions.push({
                id: 'osm_' + item.place_id,
                title,
                subtitle,
                fullAddress: `${title}, ${subtitle}`,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon)
              });
            }
          });
        }
      }
    } catch (e) {}
  }

  return suggestions;
}

// 3. GEOCODIFICAÇÃO POR PLACE_ID
export async function geocodeByPlaceId(placeId: string): Promise<GeocodedAddress | null> {
  if (!placeId) return null;

  try {
    await loadGoogleMapsSDK();

    if ((window as any).google?.maps?.Geocoder) {
      const geocoder = new (window as any).google.maps.Geocoder();
      const response = await new Promise<any>((resolve) => {
        geocoder.geocode({ placeId }, (results: any[], status: string) => {
          if (status === 'OK' && results && results[0]) {
            resolve(results[0]);
          } else {
            resolve(null);
          }
        });
      });

      if (response) {
        const lat = typeof response.geometry.location.lat === 'function' ? response.geometry.location.lat() : response.geometry.location.lat;
        const lng = typeof response.geometry.location.lng === 'function' ? response.geometry.location.lng() : response.geometry.location.lng;
        const locType = response.geometry.location_type || 'ROOFTOP';
        const parsedComp = parseAddressComponents(response.address_components || []);

        return {
          lat,
          lng,
          formattedAddress: response.formatted_address || '',
          placeId: response.place_id,
          isApproximate: locType === 'APPROXIMATE',
          locationType: locType,
          exactNumberMatched: true,
          exactStreetMatched: true,
          source: 'google_place_id',
          addressComponents: parsedComp
        };
      }
    }
  } catch (e) {
    console.warn('Erro ao geocodificar placeId:', e);
  }

  return null;
}

export async function geocodeAddress(address: {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
} | string): Promise<GeocodedAddress | null> {
  let street = '';
  let number = '';
  let neighborhood = '';
  let city = 'Campina Grande';
  let state = 'PB';

  if (typeof address === 'string') {
    street = address;
  } else if (address) {
    street = address.street || '';
    number = address.number || '';
    neighborhood = address.neighborhood || '';
    city = address.city || 'Campina Grande';
    state = address.state || 'PB';
  }

  if (!street) return null;

  const rawQuery = typeof address === 'string'
    ? address.trim()
    : `${street} ${number}, ${neighborhood}, ${city} - ${state}, Brasil`.replace(/\s+/g, ' ').trim();

  return searchFreeTextAddress(rawQuery);
}

// 4. BUSCA DIRETA DE TEXTO LIVRE
export async function searchFreeTextAddress(originalQuery: string): Promise<GeocodedAddress | null> {
  const parsedQuery = parseAddressQuery(originalQuery);
  const cleanQuery = parsedQuery.cleanedQuery || originalQuery.trim();

  // 1. Tenta Google Geocoder
  try {
    await loadGoogleMapsSDK();

    if ((window as any).google?.maps?.Geocoder) {
      const geocoder = new (window as any).google.maps.Geocoder();
      const defaultBounds = new (window as any).google.maps.LatLngBounds(
        new (window as any).google.maps.LatLng(-7.3500, -35.9800),
        new (window as any).google.maps.LatLng(-7.1500, -35.8000)
      );

      const queryToTest = cleanQuery.toLowerCase().includes('campina') ? cleanQuery : `${cleanQuery}, Campina Grande, PB, Brasil`;

      const response = await new Promise<any>((resolve) => {
        geocoder.geocode({
          address: queryToTest,
          bounds: defaultBounds,
          componentRestrictions: { country: 'BR' }
        }, (results: any[], status: string) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve({ results, status });
          } else {
            resolve({ results: [], status: status || 'ZERO_RESULTS' });
          }
        });
      });

      if (response.results && response.results.length > 0) {
        const top = response.results[0];
        const lat = typeof top.geometry.location.lat === 'function' ? top.geometry.location.lat() : top.geometry.location.lat;
        const lng = typeof top.geometry.location.lng === 'function' ? top.geometry.location.lng() : top.geometry.location.lng;
        const locType = top.geometry.location_type || 'APPROXIMATE';
        const parsedComp = parseAddressComponents(top.address_components || []);

        return {
          lat,
          lng,
          formattedAddress: top.formatted_address || cleanQuery,
          placeId: top.place_id,
          isApproximate: locType === 'APPROXIMATE',
          locationType: locType,
          requestedNumber: parsedQuery.number,
          matchedNumber: parsedComp.streetNumber || null,
          exactNumberMatched: !!(parsedComp.streetNumber && parsedComp.streetNumber === parsedQuery.number),
          exactStreetMatched: true,
          source: 'google_js_sdk',
          addressComponents: parsedComp
        };
      }
    }
  } catch (err) {
    console.warn('Erro no Geocoder do Google:', err);
  }

  // 2. Fallback Nominatim (OpenStreetMap)
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${cleanQuery}, Campina Grande, Paraiba`)}&countrycodes=br&limit=1&addressdetails=1`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const top = data[0];
        return {
          lat: parseFloat(top.lat),
          lng: parseFloat(top.lon),
          formattedAddress: top.display_name,
          isApproximate: true,
          exactNumberMatched: false,
          exactStreetMatched: true,
          source: 'nominatim_fallback'
        };
      }
    }
  } catch (e) {}

  return null;
}