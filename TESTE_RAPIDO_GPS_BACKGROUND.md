# 🧪 TESTE RÁPIDO - GPS BACKGROUND

## ⏱️ Tempo: 10 minutos

---

## 📱 **PRÉ-REQUISITOS**

- ✅ Novo APK instalado (versão 2.0 com correções de permissões)
- ⚠️ **IMPORTANTE:** Desinstalar versão antiga antes de instalar nova!
- ✅ Waze ou Google Maps instalado (para teste real)

**Por quê desinstalar versão antiga?**
Nova versão solicita 3 permissões (Location, Background, Notifications).
Desinstalar garante que todas permissões sejam solicitadas corretamente.

---

## 🎯 **TESTE DEFINITIVO: GPS + WAZE SIMULTÂNEO**

### **Cenário Real:**
Motoboy usando Waze para navegar enquanto MotoHub rastreia em background.

---

### **Passo a Passo:**

**1. Preparar MotoHub (2 min)**
```
✅ Abrir MotoHub no celular
✅ Login como motoboy

🔐 APP VAI PEDIR 3 PERMISSÕES (VERSÃO NOVA):

   1️⃣ "Permitir localização enquanto usa o app?"
      → Clique: "ENQUANTO USA O APP"
   
   2️⃣ "Permitir localização o tempo todo?"
      → Clique: "PERMITIR O TEMPO TODO" ✅ (ESSENCIAL!)
   
   3️⃣ "Permitir notificações?" (Android 13+)
      → Clique: "PERMITIR" ✅ (ESSENCIAL!)

✅ Após conceder permissões, clicar em "Iniciar Rastreamento"
✅ VERIFICAR: Notificação "🏍️ MotoHub - GPS Ativo" aparece na barra
```

**Resultado esperado:**
- ✅ 3 permissões solicitadas em sequência
- ✅ Todas permissões concedidas
- ✅ Notificação persistente visível na barra
- ✅ Ícone de localização ativo na barra de status
- ✅ Console mostra: "✅ GPS Tracking nativo iniciado"

**⚠️ Se não pediu 3 permissões:**
- Versão antiga ainda instalada (desinstalar e reinstalar)
- Android < 13 (só pede 2 permissões, tudo bem)

---

**2. Preparar Monitoramento (1 min)**
```
✅ Em outro dispositivo (PC/tablet):
   - Abrir MotoHub como Admin ou Estabelecimento
   - Abrir mapa de rastreamento
   - VERIFICAR: Motoboy aparece no mapa
   - Anotar posição inicial
```

---

**3. Abrir Waze (30 seg)**
```
✅ No celular do motoboy:
   - Apertar botão Home (minimizar MotoHub)
   - Abrir Waze
   - VERIFICAR: Notificação MotoHub ainda visível na barra
```

**CRÍTICO:** Se notificação sumiu = ❌ FALHOU

---

**4. Navegar com Waze (5 min)**
```
✅ No Waze:
   - Escolher destino qualquer (restaurante, posto, etc)
   - Iniciar navegação
   - Dirigir/caminhar seguindo as instruções
   - Mover pelo menos 500m
```

**Durante navegação, verificar NO OUTRO DISPOSITIVO:**
```
✅ Mapa MotoHub:
   - Posição do motoboy está atualizando? ✅ SIM / ❌ NÃO
   - Velocidade está correta? ✅ SIM / ❌ NÃO
   - Direção (heading) está correta? ✅ SIM / ❌ NÃO
   - Updates acontecem a cada ~5s? ✅ SIM / ❌ NÃO
```

---

**5. Parar e Validar (1 min)**
```
✅ Parar navegação no Waze
✅ Voltar ao MotoHub (abrir app minimizado)
✅ VERIFICAR: GPS ainda ativo
✅ VERIFICAR: Posição está atualizada
✅ VERIFICAR: Trajetória no mapa faz sentido
```

---

## ✅ **RESULTADO ESPERADO**

### **SE TUDO FUNCIONOU:**

Durante todo o teste:
- ✅ Notificação "GPS Ativo" sempre visível
- ✅ Posição atualizou continuamente no mapa
- ✅ Waze e MotoHub funcionaram simultaneamente
- ✅ Trajetória no mapa está correta
- ✅ Velocidade e direção razoáveis

**Conclusão:** 🟢 **GPS BACKGROUND FUNCIONANDO 100%**

---

### **SE ALGO FALHOU:**

**Cenário A: Notificação sumiu ao abrir Waze (ou nunca apareceu)**
❌ **Problema:** Permissão de notificação negada ou foreground service não iniciou
🔧 **Solução:** 
```
1. Verificar permissões manualmente:
   Configurações → Apps → MotoHub → Permissões
   - Localização: "Permitir o tempo todo" ✅
   - Notificações: "Permitir" ✅

2. Verificar canal de notificação:
   Configurações → Apps → MotoHub → Notificações
   - "Rastreamento GPS": ATIVAR ✅

3. Se ainda falhar:
   - Desinstalar app completamente
   - Reinstalar APK novo
   - Conceder todas 3 permissões quando solicitadas
```

---

**Cenário B: Posição parou de atualizar após 1-2 min**
❌ **Problema:** Otimização de bateria matou o serviço
🔧 **Solução:**
```
Configurações > Apps > MotoHub Delivery
  > Bateria > "Não otimizar"
  > Reiniciar teste
```

---

**Cenário C: Posição atualiza mas muito lento (30s+)**
⚠️ **Problema:** Throttle muito agressivo ou GPS fraco
🔧 **Solução:**
- Verificar signal GPS (barras na notificação)
- Teste em área aberta (evitar prédios altos)
- Ajustar `UPDATE_INTERVAL` no GpsTrackingService.java se necessário

---

**Cenário D: Plugin não encontrado**
❌ **Problema:** Build não incluiu código nativo
🔧 **Solução:**
```bash
# Limpar e rebuild
rm -rf android/app/build
pnpm run build
npx cap sync android

# Android Studio
Build > Clean Project
Build > Rebuild Project
Build > Build APK(s)
```

---

## 📊 **LOGS PARA VERIFICAR**

### **Android Studio Logcat (se tiver USB conectado):**

**Filtro:** `GpsTracking`

**Logs de sucesso (VERSÃO NOVA):**
```
D/GpsTrackingPlugin: startTracking() called
D/GpsTrackingPlugin: All permissions granted
D/GpsTrackingPlugin: Starting GPS service...
D/GpsTrackingService: =====================================
D/GpsTrackingService: onStartCommand() called
D/GpsTrackingService: Criando canal de notificação...
D/GpsTrackingService: ✅ Canal criado: gps_tracking_channel
D/GpsTrackingService: Criando notificação...
D/GpsTrackingService: ✅ Notificação construída com sucesso
D/GpsTrackingService: Chamando startForeground()...
D/GpsTrackingService: ✅ startForeground() executado com sucesso!
D/GpsTrackingService: ✅ Serviço completamente inicializado!
D/GpsTrackingService: =====================================
D/GpsTrackingPlugin: ✅ GPS tracking started successfully!
```

**Logs de erro de permissão:**
```
D/GpsTrackingPlugin: Location permission missing, requesting...
E/GpsTrackingPlugin: Location permission denied
-- OU --
D/GpsTrackingPlugin: Background location permission missing, requesting...
E/GpsTrackingPlugin: Background location permission denied
-- OU --
D/GpsTrackingPlugin: Notification permission missing, requesting...
E/GpsTrackingPlugin: Notification permission denied
```

**Logs de erro de serviço:**
```
E/GpsTrackingService: ❌ ERRO: Notification é null!
E/GpsTrackingService: ❌ NotificationManager é null!
E/GpsTrackingService: ❌ ERRO no startForeground(): ...
```

---

### **Chrome DevTools (se tiver USB debugging):**

**Console do navegador:**

**Logs de sucesso:**
```
🛰️ Iniciando GPS Tracking nativo (Foreground Service)...
✅ GPS Tracking nativo iniciado: GPS tracking started
📍 Location update do serviço nativo: {latitude: -23.xxxx, ...}
📍 Background GPS: 12.5m moved, 5s elapsed
```

**Logs de fallback:**
```
⚠️ Plugin GpsTracking não disponível, usando fallback: Error...
```

---

## 🔄 **TESTE ALTERNATIVO: TELA APAGADA**

Se não tiver Waze ou não quiser dirigir:

**1. Iniciar GPS tracking (MotoHub)**
**2. Apertar botão Power (apagar tela)**
**3. Caminhar 200m com celular no bolso**
**4. Acender tela e verificar mapa**

**Resultado esperado:**
- ✅ Posição atualizou durante tela apagada
- ✅ Trajetória está desenhada no mapa

---

## 📞 **TROUBLESHOOTING RÁPIDO**

### **Notificação não aparece:**
```
1. Verificar se app solicitou 3 permissões:
   - Se não: Desinstalar e reinstalar APK
   
2. Verificar permissões manualmente:
   Configurações → Apps → MotoHub
   - Localização: "Permitir o tempo todo" ✅
   - Notificações: "Permitir" ✅
   
3. Verificar canal de notificação:
   Configurações → Apps → MotoHub → Notificações
   - "Rastreamento GPS": ATIVAR ✅
   
4. Fabricantes específicos (Xiaomi/Samsung):
   - Desabilitar otimização de bateria
   - Adicionar na lista de apps protegidos
```

### **GPS para em background:**
```
1. Desabilitar otimização de bateria
2. Permitir "Localização o tempo todo"
3. Testar em área aberta (melhor sinal GPS)
```

### **Logs mostram erro de permissão:**
```
1. Desinstalar app completamente
2. Reinstalar APK NOVO (versão 2.0)
3. Ao fazer login, permitir TODAS as 3 permissões:
   - Localização: "Enquanto usa o app" (primeiro)
   - Background: "Permitir o tempo todo" (segundo) ✅
   - Notificações: "Permitir" (terceiro) ✅
4. Se Android < 13, só vai pedir 2 permissões (OK)
```

---

## ✅ **CHECKLIST FINAL**

Após teste completo:

**GPS Background:**
- [ ] Funciona com app minimizado
- [ ] Funciona com tela apagada
- [ ] Funciona usando Waze simultaneamente
- [ ] Notificação persistente sempre visível
- [ ] Posição atualiza a cada 5s aproximadamente

**Precisão:**
- [ ] Localização no mapa está correta (±10m)
- [ ] Velocidade está razoável
- [ ] Direção (seta) aponta corretamente
- [ ] Trajetória faz sentido

**Performance:**
- [ ] Sem travamentos ou crashes
- [ ] Bateria não aquece excessivamente
- [ ] Transição entre apps é suave

---

## 🎉 **APROVAÇÃO**

**Se TODOS os itens acima estão ✅:**

**✅ GPS BACKGROUND ESTÁ FUNCIONANDO PERFEITAMENTE!**

Sistema pronto para produção. GPS 100% confiável igual iFood/Uber.

---

**Se ALGUM item está ❌:**

**⚠️ AJUSTES NECESSÁRIOS**

Revisar documentação:
- `INTEGRACAO_GPS_NATIVO_COMPLETA.md` - Troubleshooting completo
- `ESTADO_ATUAL_IMPLEMENTACAO.md` - Status geral
- Logs do Logcat - Diagnóstico técnico

---

**Tempo total do teste:** ⏱️ **10 minutos**

**Complexidade:** 🟢 **Fácil** (apenas usar o app normalmente)

**Resultado:** 🎯 **Definitivo** (prova que funciona em condições reais)

---

---

## 🆕 **NOVIDADES VERSÃO 2.0**

Esta versão corrige o problema da notificação não aparecer:

✅ **Solicita explicitamente 3 permissões** em sequência  
✅ **Valida cada permissão** antes de iniciar GPS  
✅ **Logs detalhados** para diagnóstico (✅/❌)  
✅ **Canal de notificação** criado e verificado  
✅ **Notificação garantida** com flags corretas (Android 12+)  
✅ **Visibilidade pública** na tela de bloqueio  

**Resultado:** Notificação persistente 100% funcional!

---

_Guia de teste criado: 21 de Setembro de 2026_  
_Atualizado: 27 de Setembro de 2026 - Versão 2.0_
