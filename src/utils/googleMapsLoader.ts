"use client";

let loadPromise: Promise<void> | null = null;

export function getGoogleMapsApiKey(): string {
  return (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.GOOGLE_MAPS_API_KEY ||
    (typeof window !== 'undefined' ? ((window as any).VITE_GOOGLE_MAPS_API_KEY || (window as any).GOOGLE_MAPS_API_KEY) : '') ||
    'AIzaSyD9IRVxwE2t_yG3FdkamEZLf0iotHh67YE'
  );
}

export function loadGoogleMapsSDK(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject('SSR environment');

  if ((window as any).google?.maps?.places) {
    return Promise.resolve();
  }

  if (loadPromise) return loadPromise;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error('Chave VITE_GOOGLE_MAPS_API_KEY não configurada.'));
  }

  loadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-maps-js-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;

    (window as any).gm_authFailure = () => {
      console.warn('Google Maps API: Erro de autenticação. Verifique se a Places API, Directions API e Geocoding API estão habilitadas no Google Cloud Console.');
    };

    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Falha ao carregar o SDK do Google Maps. Verifique a chave da API.'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}