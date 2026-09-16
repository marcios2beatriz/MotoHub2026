// Web Worker para manter a captura do GPS ativa no celular mesmo em segundo plano
// Tick a cada 5s — reduz chamadas de getCurrentPosition sem comprometer a precisão
let timer = null;

self.onmessage = function (e) {
  if (e.data === 'start') {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      self.postMessage('tick');
    }, 5000);
  } else if (e.data === 'stop') {
    if (timer) clearInterval(timer);
    timer = null;
  }
};