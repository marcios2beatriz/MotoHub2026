# 🧪 TESTE RÁPIDO - GPS BACKGROUND

## ⏱️ Tempo: 10 minutos

---

## 📱 **PRÉ-REQUISITOS**

- APK instalado no celular Android
- Login como motoboy configurado
- Waze ou Google Maps instalado

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
✅ Clicar em "Iniciar Rastreamento"
✅ VERIFICAR: Notificação "🏍️ MotoHub - GPS Ativo" aparece na barra
```

**Resultado esperado:**
- Notificação persistente visível
- Ícone de localização ativo na barra
- Console mostra: "✅ GPS Tracking nativo iniciado"

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

**Cenário A: Notificação sumiu ao abrir Waze**
❌ **Problema:** Foreground service não iniciou
🔧 **Solução:** 
- Verificar logs do Logcat (GpsTrackingService)
- Verificar se `registerPlugin(GpsTrackingPlugin.class)` está no MainActivity
- Rebuild completo do projeto

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

**Logs de sucesso:**
```
I/GpsTrackingService: onCreate() - Serviço iniciado
I/GpsTrackingService: onStartCommand() - Foreground iniciado
I/GpsTrackingService: Notificação criada: GPS Ativo
I/GpsTrackingService: processLocationUpdate() - distance: 12.5m
I/GpsTrackingService: Enviando broadcast GPS_LOCATION_UPDATE
```

**Logs de erro:**
```
E/GpsTrackingPlugin: Failed to start service: ...
E/GpsTrackingService: Location permission denied
E/GpsTrackingService: FusedLocationProvider failed: ...
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
1. Verificar permissões (Localização + Notificações)
2. Verificar MainActivity.java tem registerPlugin()
3. Rebuild completo
```

### **GPS para em background:**
```
1. Desabilitar otimização de bateria
2. Permitir "Localização o tempo todo"
3. Testar em área aberta (melhor sinal GPS)
```

### **Logs mostram erro de permissão:**
```
1. Desinstalar app
2. Reinstalar APK
3. Permitir TODAS as permissões
4. Escolher "Sempre permitir localização"
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

_Guia de teste criado: 21 de Setembro de 2026_
