# 📱 GUIA VISUAL RÁPIDO - O QUE ESPERAR

## 🎯 Como saber se está funcionando

---

## 1️⃣ **GPS BACKGROUND FUNCIONANDO**

### **✅ SINAIS DE SUCESSO:**

**Na barra de notificações do Android:**
```
┌─────────────────────────────────────┐
│ 🏍️ MotoHub - GPS Ativo             │
│ Rastreamento ativo • 45 km/h        │  ← Esta notificação SEMPRE visível
└─────────────────────────────────────┘
```

**No dashboard (outro dispositivo):**
```
╔═══════════════════════════════════╗
║  MAPA                             ║
║                                   ║
║      [Estabelecimento] 🏪         ║
║             ↓                     ║
║             │  3.2 km             ║
║             ↓                     ║
║      🏍️ → João Silva              ║  ← Motoboy SE MOVENDO
║      (2 segundos atrás)           ║
║                                   ║
╚═══════════════════════════════════╝
```

**No Logcat (Android Studio):**
```
✅ GPS Tracking nativo iniciado
📍 Location update: lat=-23.xxxx, speed=45km/h
📍 Location update: lat=-23.xxxy, speed=47km/h
📍 Location update: lat=-23.xxxz, speed=44km/h
```

---

### **❌ SINAIS DE FALHA:**

**Notificação sumiu:**
```
┌─────────────────────────────────────┐
│ (vazio - nenhuma notificação)       │  ← ❌ GPS parou
└─────────────────────────────────────┘
```

**No dashboard:**
```
╔═══════════════════════════════════╗
║  MAPA                             ║
║                                   ║
║      [Estabelecimento] 🏪         ║
║                                   ║
║                                   ║
║                                   ║
║      🏍️ João Silva                ║  ← Não se move
║      (5 minutos atrás)            ║     Tempo aumentando
║                                   ║
╚═══════════════════════════════════╝
```

**No Logcat:**
```
⚠️ Plugin GpsTracking não disponível
⚠️ BackgroundGeolocation fallback
❌ Location updates stopped
```

---

## 2️⃣ **NOTIFICAÇÕES FUNCIONANDO**

### **✅ COMO DEVE SER:**

**Estabelecimento envia mensagem:**
```
Desktop/Web:
1. Estabelecimento digita: "Corrida nova!"
2. Clica em "Enviar"
3. Mensagem aparece no chat ✅
```

**Motoboy recebe (app minimizado):**
```
CELULAR:
┌─────────────────────────────────────┐
│ 📱 BARRA DE NOTIFICAÇÕES:           │
├─────────────────────────────────────┤
│ 💬 Mensagem de Pizzaria Central     │  ← Aparece na barra
│ Corrida nova!                       │
│ Agora                               │
└─────────────────────────────────────┘

🔊 SOM: "Beep-beep" (duas notas)
📳 VIBRAÇÃO: bzz-bzz-bzz
```

**Motoboy abre o app:**
```
APP ABERTO:
┌─────────────────────────────────────┐
│ 💬 Pizzaria Central                 │  ← Toast no topo
│ Corrida nova!                       │     (5 segundos)
└─────────────────────────────────────┘

[Minhas Escalas]
[📅 Chat com Estabelecimento] 🔴 ← Badge vermelho
```

---

### **❌ SE NÃO FUNCIONAR:**

**Silêncio total:**
```
CELULAR:
┌─────────────────────────────────────┐
│ 📱 BARRA DE NOTIFICAÇÕES:           │
├─────────────────────────────────────┤
│ (vazio)                             │  ← Nada aparece
└─────────────────────────────────────┘

🔇 SEM SOM
📳 SEM VIBRAÇÃO
```

**App aberto - sem visual:**
```
APP ABERTO:
┌─────────────────────────────────────┐
│ (sem toast)                         │  ← Nenhum banner
└─────────────────────────────────────┘

[Minhas Escalas]
[📅 Chat com Estabelecimento]  ← Sem badge
```

---

## 3️⃣ **TESTE WAZE SIMULTÂNEO**

### **✅ CENÁRIO IDEAL:**

```
TELA DO CELULAR:

┌─────────────────────────────────────┐
│ ⬅️ 12:45 PM          📶 🔋 [88%]   │
├─────────────────────────────────────┤
│ 🏍️ MotoHub - GPS Ativo  [×]        │  ← MotoHub ativo
│ 🚗 Waze: Via Dutra • 5 min         │  ← Waze ativo
│ ♪ Spotify: Playlist Entrega        │  ← Música ativa
└─────────────────────────────────────┘

WAZE ABERTO (navegando):
╔═══════════════════════════════════╗
║  🚗 WAZE                          ║
║                                   ║
║     ↑ Siga em frente              ║
║     500m até virar à direita      ║
║                                   ║
║  [═══════════] 45 km/h            ║
║                                   ║
║  Chegada: 12:58 PM                ║
╚═══════════════════════════════════╝

DASHBOARD (outro dispositivo):
╔═══════════════════════════════════╗
║  📍 Rastreamento Tempo Real       ║
║                                   ║
║  🏍️ João Silva                    ║
║  ↗️ 45 km/h • Via Dutra           ║  ← SE MOVENDO!
║  Última atualização: 2s atrás     ║
║                                   ║
║  [Ver trajeto completo]           ║
╚═══════════════════════════════════╝
```

**Todos funcionam juntos! ✅**

---

### **❌ CENÁRIO DE FALHA:**

```
TELA DO CELULAR:

┌─────────────────────────────────────┐
│ ⬅️ 12:45 PM          📶 🔋 [88%]   │
├─────────────────────────────────────┤
│ 🚗 Waze: Via Dutra • 5 min         │  ← Só Waze aparece
│ (MotoHub não está aqui)            │  ← ❌ GPS parou
└─────────────────────────────────────┘

DASHBOARD (outro dispositivo):
╔═══════════════════════════════════╗
║  📍 Rastreamento Tempo Real       ║
║                                   ║
║  🏍️ João Silva                    ║
║  🔴 OFFLINE                        ║  ← NÃO MOVE
║  Última atualização: 5 min atrás  ║  ← Tempo cresce
║                                   ║
║  ⚠️ Sem sinal GPS                 ║
╚═══════════════════════════════════╝
```

**Waze matou o MotoHub GPS ❌**

---

## 4️⃣ **INDICADORES DE PERFORMANCE**

### **✅ BOM DESEMPENHO:**

**Bateria:**
```
AFTER 1 HOUR:
100% ████████████████████ 90%  ← Perda de 10% OK

AFTER 4 HOURS:
100% ████████████████████ 60%  ← ~10%/hora OK
```

**Precisão GPS:**
```
MAPA:
╔═══════════════════════════════════╗
║  Rua Real:                        ║
║  ━━━━━━━━━━━━━━━━━━━              ║
║                                   ║
║  Posição GPS:                     ║
║  ━━━━━━━━━━━━━━━━━━━ 🏍️          ║  ← Alinhado
║                                   ║
║  Diferença: ~5 metros ✅          ║
╚═══════════════════════════════════╝
```

**Updates:**
```
LOGS:
12:00:00 - Location update (lat: -23.5505)
12:00:05 - Location update (lat: -23.5506)  ← 5s
12:00:10 - Location update (lat: -23.5507)  ← 5s
12:00:15 - Location update (lat: -23.5508)  ← 5s
```

---

### **❌ MAU DESEMPENHO:**

**Bateria:**
```
AFTER 1 HOUR:
100% ████████████████████ 70%  ← Perda de 30% ❌

AFTER 4 HOURS:
100% ████████████████████ 0%   ← Bateria morreu ❌
```

**Precisão GPS:**
```
MAPA:
╔═══════════════════════════════════╗
║  Rua Real:                        ║
║  ━━━━━━━━━━━━━━━━━━━              ║
║           🏍️                      ║  ← 50m fora
║  Posição GPS:                     ║     da rua ❌
║  ━━━━━━━━━━━━━━━━━━━              ║
║                                   ║
║  Diferença: ~50 metros ❌         ║
╚═══════════════════════════════════╝
```

**Updates:**
```
LOGS:
12:00:00 - Location update (lat: -23.5505)
12:00:35 - Location update (lat: -23.5506)  ← 35s ⚠️
12:01:20 - Location update (lat: -23.5507)  ← 45s ❌
(updates muito lentos)
```

---

## 5️⃣ **PERMISSÕES CORRETAS**

### **✅ CONFIGURAÇÃO IDEAL:**

```
CONFIGURAÇÕES > APPS > MOTOHUB DELIVERY

┌─────────────────────────────────────┐
│ Permissões do app                   │
├─────────────────────────────────────┤
│                                     │
│ 📍 Localização                      │
│    Permitir o tempo todo ✅         │  ← CRÍTICO
│    (não "Apenas durante uso")       │
│                                     │
│ 🔔 Notificações                     │
│    Permitidas ✅                    │
│                                     │
│ 🔋 Bateria                          │
│    Não otimizar ✅                  │  ← CRÍTICO
│    (desabilitar economia)           │
│                                     │
│ 📱 Executar em segundo plano        │
│    Permitido ✅                     │
│                                     │
└─────────────────────────────────────┘
```

---

### **❌ CONFIGURAÇÃO ERRADA:**

```
CONFIGURAÇÕES > APPS > MOTOHUB DELIVERY

┌─────────────────────────────────────┐
│ Permissões do app                   │
├─────────────────────────────────────┤
│                                     │
│ 📍 Localização                      │
│    Apenas durante o uso ❌          │  ← GPS para
│    (precisa ser "o tempo todo")     │     em background
│                                     │
│ 🔔 Notificações                     │
│    Bloqueadas ❌                    │  ← Não recebe
│                                     │     mensagens
│ 🔋 Bateria                          │
│    Otimizar (recomendado) ❌        │  ← Sistema mata
│    (sistema mata o app)             │     o GPS
│                                     │
│ 📱 Executar em segundo plano        │
│    Restrito ❌                      │
│                                     │
└─────────────────────────────────────┘
```

---

## 🎯 **RESUMO VISUAL**

### **SISTEMA FUNCIONANDO 100%:**

```
┌─────────────────────────────────────┐
│ CELULAR DO MOTOBOY:                 │
│                                     │
│ ✅ Notificação GPS sempre visível   │
│ ✅ Waze aberto navegando            │
│ ✅ Bateria durando bem (~10%/h)     │
│ ✅ Sem travamentos                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ DASHBOARD ESTABELECIMENTO:          │
│                                     │
│ ✅ Motoboy se movendo no mapa       │
│ ✅ Updates a cada 5 segundos        │
│ ✅ Velocidade e direção corretas    │
│ ✅ Trajeto desenhado corretamente   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ NOTIFICAÇÕES:                       │
│                                     │
│ ✅ Chegam na barra do Android       │
│ ✅ Som + vibração funcionam         │
│ ✅ Toast aparece ao abrir app       │
│ ✅ Badge no botão de chat           │
└─────────────────────────────────────┘
```

---

### **SISTEMA COM PROBLEMAS:**

```
┌─────────────────────────────────────┐
│ CELULAR DO MOTOBOY:                 │
│                                     │
│ ❌ Notificação GPS sumiu            │
│ ⚠️ Waze funcionando sozinho         │
│ ⚠️ Bateria acabando rápido          │
│ ❌ App travando/fechando            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ DASHBOARD ESTABELECIMENTO:          │
│                                     │
│ ❌ Motoboy parado no mapa           │
│ ❌ "5 minutos atrás"                │
│ ❌ Posição desatualizada            │
│ ❌ Sem trajeto                      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ NOTIFICAÇÕES:                       │
│                                     │
│ ❌ Nada aparece na barra            │
│ ❌ Sem som nem vibração             │
│ ❌ Sem toast visual                 │
│ ❌ Sem badge nos botões             │
└─────────────────────────────────────┘
```

---

## 🆘 **O QUE FAZER SE FALHAR**

### **GPS parou:**
```
1. Verificar notificação ainda visível? ❌
   → Reabrir app e "Iniciar Rastreamento"

2. Notificação presente mas sem updates? ⚠️
   → Verificar permissões (Localização "o tempo todo")
   → Desabilitar otimização de bateria

3. Nada funciona? ❌
   → Ver logs no Logcat (Android Studio)
   → Consultar INTEGRACAO_GPS_NATIVO_COMPLETA.md
```

### **Notificações não chegam:**
```
1. App aberto: Toast aparece? ✅
   → Notificação web OK, problema no nativo

2. App fechado: Nada chega? ❌
   → Verificar permissão de notificações
   → Verificar canais de notificação (Config Android)

3. Som não toca? 🔇
   → Verificar volume do celular
   → Testar playNotificationSound() manual
```

---

**Use este guia para validar rapidamente se tudo está funcionando!**

_Guia visual criado: 21 de Setembro de 2026_
