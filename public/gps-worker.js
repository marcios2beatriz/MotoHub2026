// Web Worker para manter a captura do GPS ativa no celular mesmo em segundo plano
// Intervalos otimizados: Mobile (7s) vs Desktop (5s) para economia de bateria
// Background mode: intervals mais frequentes quando app está minimizado
let timer = null;
let backgroundTimer = null;
let isBackgroundMode = false;

// Detectar se está em mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const TICK_INTERVAL = isMobile ? 7000 : 5000; // Mobile: 7s, Desktop: 5s
const BACKGROUND_TICK_INTERVAL = isMobile ? 4000 : 3000; // Mais frequente em background

self.onmessage = function (e) {
  if (e.data === 'start') {
    isBackgroundMode = false;
    
    // Para timers existentes
    if (timer) clearInterval(timer);
    if (backgroundTimer) clearInterval(backgroundTimer);
    
    // Inicia timer normal
    timer = setInterval(() => {
      self.postMessage('tick');
    }, TICK_INTERVAL);
    
  } else if (e.data === 'start-background' || e.data === 'start-aggressive') {
    isBackgroundMode = true;
    
    // Para timer normal e inicia timer de background
    if (timer) clearInterval(timer);
    if (backgroundTimer) clearInterval(backgroundTimer);
    
    console.log('📱 GPS Worker: Modo background ativo');
    backgroundTimer = setInterval(() => {
      self.postMessage('tick');
    }, BACKGROUND_TICK_INTERVAL);
    
  } else if (e.data === 'stop') {
    if (timer) clearInterval(timer);
    if (backgroundTimer) clearInterval(backgroundTimer);
    timer = null;
    backgroundTimer = null;
    isBackgroundMode = false;
  }
};