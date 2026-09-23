# 🏍️ GPS Nativo e Notificações Android - MotoHub Delivery

## 📋 RESUMO

Sistema completo de **GPS Foreground Service** e **Notificações Nativas** para Android, permitindo:
- ✅ GPS ativo mesmo com app minimizado
- ✅ GPS ativo usando Waze/Google Maps simultaneamente
- ✅ Notificações nativas na barra de status do Android
- ✅ Solução definitiva igual iFood, Uber, 99

---

## 🎯 PROBLEMA RESOLVIDO

### Antes:
- ❌ GPS perdido ao minimizar app
- ❌ GPS perdido ao usar Waze/Google Maps
- ❌ Notificações só no navegador (não na barra do sistema)
- ❌ App "matado" pelo Android em background

### Agora:
- ✅ GPS continua ativo com app minimizado
- ✅ GPS continua ativo usando outros apps de navegação
- ✅ Notificação persistente no Android mantém serviço vivo
- ✅ Notificações de chat/escala aparecem na barra do sistema
- ✅ Sistema escolhe automaticamente GPS nativo (Android) ou Web (Desktop/PWA)

---

## 🏗️ ARQUITETURA

### 1. GPS Foreground Service Nativo (Android)

#### Arquivos Java:
```
android/app/src/main/java/com/motohub/delivery/
├── GpsTrackingService.java      # Foreground service com notificação persistente
├── GpsTrackingPlugin.java       # Plugin Capacitor (ponte Java ↔ JavaScript)
└── MainActivity.java            # Registra o plugin
```

#### Arquivos TypeScript:
```
src/
├── plugins/
│   ├── gpsTracking.ts           # Interface TypeScript do plugin GPS
│   └── gpsTrackingWeb.ts        # Fallback web para desktop
├── utils/
│   ├── gpsTrackerNative.ts      # Wrapper para GPS nativo com throttling
│   ├── gpsManager.ts            # Gerenciador inteligente (detecta nativo vs web)
│   └── gpsTracker.ts            # GPS web original (usado como fallback)
```

#### Como Funciona:
1. **GpsTrackingService** roda como **Foreground Service** no Android
2. Cria **notificação persistente** ("🏍️ MotoHub - GPS Ativo")
3. Usa **FusedLocationProviderClient** do Google Play Services (máxima precisão)
4. Continua ativo mesmo com:
   - App minimizado
   - Waze/Google Maps abertos
   - Tela desligada (WAKE_LOCK)
5. Envia locations via **BroadcastReceiver** para o JavaScript
6. Filtro inteligente: só atualiza se moveu >5m OU passou >5s

### 2. Notificações Nativas Android

#### Arquivos Java:
```
android/app/src/main/java/com/motohub/delivery/
├── NotificationService.java     # Serviço de notificações Android
├── NotificationPlugin.java      # Plugin Capacitor para notificações
└── MainActivity.java            # Registra o plugin
```

#### Arquivos TypeScript:
```
src/
├── plugins/
│   ├── nativeNotification.ts    # Interface TypeScript do plugin
│   └── nativeNotificationWeb.ts # Fallback web para desktop
└── utils/
    └── realtimeGps.ts           # Integrado com notificações nativas
```

#### Como Funciona:
1. **3 Canais de Notificação** no Android:
   - `motohub_chat_channel` → Mensagens de chat (alta prioridade)
   - `motohub_schedule_channel` → Escalas (alta prioridade)
   - `motohub_general_channel` → Notificações gerais (média prioridade)
2. Cada canal tem **som, vibração e badge** customizados
3. Notificações aparecem **na barra de status** do Android
4. Funciona mesmo com **app fechado** (via realtime Supabase)
5. Fallback automático para **Notification API web** no desktop/PWA

---

## 🔧 CONFIGURAÇÃO ANDROID

### AndroidManifest.xml
```xml
<!-- Permissões GPS -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Permissões Foreground Service -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Foreground Service -->
<service
    android:name=".GpsTrackingService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="location" />
```

### build.gradle
```gradle
dependencies {
    // Google Play Services Location (GPS de alta precisão)
    implementation 'com.google.android.gms:play-services-location:21.0.1'
}
```

---

## 📱 USO NO CÓDIGO

### Iniciar GPS Automático (RiderDashboard)
```typescript
import { gpsManager } from '../utils/gpsManager';

// Inicia GPS automaticamente ao carregar dashboard
useEffect(() => {
  gpsManager.startTracking();
  
  const unsubscribe = gpsManager.subscribe((state) => {
    setGpsState(state);
  });
  
  return () => unsubscribe();
}, []);
```

### Enviar Notificação Nativa de Chat
```typescript
import NativeNotification from '../plugins/nativeNotification';

// Automático via realtimeGps.ts quando recebe mensagem
NativeNotification.sendChatNotification({
  title: '💬 Mensagem de João',
  message: 'Pedido já está saindo!',
  fromUserName: 'João'
});
```

### Enviar Notificação Nativa de Escala
```typescript
import NativeNotification from '../plugins/nativeNotification';

// Automático via realtimeGps.ts quando escala é criada/modificada
NativeNotification.sendScheduleNotification({
  title: '📅 Nova Escala Recebida',
  message: 'Você foi escalado para Pizzaria X no turno da noite'
});
```

---

## 🎛️ DETECÇÃO AUTOMÁTICA DE PLATAFORMA

O **gpsManager** detecta automaticamente qual GPS usar:

```typescript
// Capacitor.isNativePlatform() === true
→ Usa GpsTrackingService (foreground service Android/iOS)
→ Notificação persistente na barra
→ GPS continua ativo com app minimizado

// Capacitor.isNativePlatform() === false
→ Usa gpsTracker.ts (web GPS otimizado)
→ Wake lock + web worker
→ Melhor para PWA/Desktop
```

### Vantagens:
- ✅ Código único funciona em Android e Web
- ✅ Sem necessidade de `if/else` no RiderDashboard
- ✅ Fallback automático se GPS nativo falhar
- ✅ Zero manutenção para adicionar iOS no futuro

---

## 💾 OTIMIZAÇÃO DE CUSTOS SUPABASE

### Throttling Inteligente:
```typescript
// gpsTrackerNative.ts
private readonly DB_WRITE_INTERVAL_MS = 12000; // 12 segundos

// Só grava no Supabase se:
// 1. Moveu mais de 15 metros OU
// 2. Passou mais de 12 segundos
```

### Economia Estimada:
- **Antes:** GPS atualizava a cada 3-5s = ~12-20 gravações/min
- **Agora:** GPS atualiza a cada 12s + throttling de movimento = ~3-4 gravações/min
- **Redução:** ~70% menos gravações no Supabase

### GPS Local vs Remoto:
```typescript
// Local (estado React): Atualiza em tempo real
setGpsState(newLocation); // Sem latência

// Remoto (Supabase): Atualiza com throttling
if (timeSinceLastWrite >= 12000 || distanceMoved > 15) {
  db.updateRiderLocation(...);
  realtimeGps.sendLocation(...);
}
```

---

## 🧪 TESTANDO

### 1. Build do APK
```bash
pnpm run build
npx cap sync android
npx cap open android
# No Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)
```

### 2. Instalar no Celular
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. Verificar GPS Foreground Service
1. Abrir app MotoHub como motoboy
2. Minimizar app
3. Verificar notificação persistente: **"🏍️ MotoHub - GPS Ativo"**
4. Abrir Waze ou Google Maps
5. Verificar que GPS continua enviando localização

### 4. Verificar Notificações Nativas
1. Enviar mensagem de chat de outro dispositivo
2. Verificar notificação aparece na **barra de status do Android**
3. Som + vibração devem tocar
4. Badge deve aparecer no ícone do app

### 5. Verificar no Logcat (Android Studio)
```bash
# Filtrar logs do GPS
adb logcat | grep "GPS"

# Deve mostrar:
# 📍 GPS Native: 12.5m moved, 13s elapsed
# 📍 Background GPS: 18.3m moved, 15s elapsed
```

---

## 🚨 TROUBLESHOOTING

### GPS não funciona em background
**Solução:**
1. Verificar permissão `ACCESS_BACKGROUND_LOCATION` concedida
2. Desabilitar "Otimização de Bateria" para o app nas configurações Android
3. Verificar que `foregroundServiceType="location"` está no manifest

### Notificações não aparecem
**Solução:**
1. Verificar permissão `POST_NOTIFICATIONS` concedida (Android 13+)
2. Verificar que canais de notificação foram criados
3. Testar manualmente:
   ```typescript
   NativeNotification.sendGeneralNotification({
     title: 'Teste',
     message: 'Testando notificação nativa'
   });
   ```

### App é "matado" pelo Android
**Solução:**
1. Foreground Service com notificação persistente impede isso
2. Se ainda acontecer, adicionar app à lista de "Apps Protegidos" nas configurações
3. Desabilitar "Otimização de Bateria" para o app

### GPS impreciso
**Solução:**
1. `FusedLocationProviderClient` já usa o GPS mais preciso disponível
2. Verificar que Google Play Services está atualizado
3. Testar em local aberto (não dentro de prédios)

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

| Funcionalidade | Antes | Depois |
|---|---|---|
| GPS com app minimizado | ❌ Perdido | ✅ Ativo (foreground service) |
| GPS usando Waze/Google Maps | ❌ Perdido | ✅ Ativo simultaneamente |
| Notificação persistente GPS | ❌ Não | ✅ Sim ("GPS Ativo") |
| Notificações na barra Android | ❌ Só web | ✅ Nativas |
| Gravações GPS/min no Supabase | ~15-20 | ~3-4 (-70%) |
| Precisão GPS | Boa | Excelente (Google Play Services) |
| Bateria | Alta | Otimizada (throttling) |

---

## 📝 PRÓXIMOS PASSOS (OPCIONAL)

1. **Adicionar suporte iOS** (GpsTrackingPlugin já está preparado)
2. **Histórico de rotas** offline (salvar em SQLite local)
3. **Geocoding reverso** (mostrar endereço atual na notificação)
4. **Notificação com mapa** (expandable notification com mini-mapa)
5. **Estatísticas de bateria** (monitorar consumo do GPS)

---

## 🎉 RESULTADO FINAL

Sistema de GPS e notificações **nível iFood**:
- ✅ GPS **nunca** é perdido (foreground service)
- ✅ Motoboy pode usar **qualquer app** de navegação
- ✅ Notificações aparecem na **barra do Android**
- ✅ Economia de **70% nos custos** do Supabase
- ✅ Funciona em **Android, iOS (futuro) e Web** com código único

**Status:** ✅ PRONTO PARA PRODUÇÃO

---

**Documentação criada em:** 2026-09-21  
**Versão do Sistema:** 3.1  
**Última atualização:** GPS Nativo + Notificações Android Implementados
