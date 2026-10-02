# 📱 GUIA PASSO A PASSO: GERAR E INSTALAR APK

## 🎯 **OBJETIVO**
Gerar APK com GPS Background funcionando 100%

---

## ✅ **PASSO 1: LIMPAR BUILD ANTERIOR (Recomendado)**

```bash
# Limpar cache e builds antigos
Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
```

**Tempo:** 10 segundos

---

## ✅ **PASSO 2: BUILD DO PROJETO**

```bash
pnpm run build
```

**O que esperar:**
```
✓ built in 45s
dist/ folder created
```

**Tempo:** 1-2 minutos

**⚠️ Se houver ERRO aqui, PARE e me avise!**

---

## ✅ **PASSO 3: SYNC COM CAPACITOR**

```bash
npx cap sync android
```

**O que esperar:**
```
✔ Copying web assets from dist to android/app/src/main/assets/public
✔ Creating capacitor.config.json in android/app/src/main/assets
✔ copy android in 500ms
✔ Updating Android plugins in 150ms
✔ sync android in 650ms
```

**Tempo:** 30 segundos

**⚠️ Se houver ERRO aqui, PARE e me avise!**

---

## ✅ **PASSO 4: ABRIR ANDROID STUDIO**

```bash
npx cap open android
```

**O que esperar:**
- Android Studio abre
- Projeto carrega
- "Gradle sync" roda automaticamente

**Aguardar:** Gradle sync finalizar (barra de progresso embaixo)

**Tempo:** 1-2 minutos

**⚠️ Se Android Studio NÃO abrir:**
```
1. Abrir Android Studio manualmente
2. File > Open
3. Selecionar pasta: android/
4. Aguardar Gradle sync
```

---

## ✅ **PASSO 5: BUILD APK NO ANDROID STUDIO**

### **Método 1: Menu (Recomendado)**
```
1. Build > Clean Project (aguardar terminar)
2. Build > Rebuild Project (aguardar terminar ~2 min)
3. Build > Build Bundle(s) / APK(s) > Build APK(s)
4. Aguardar mensagem: "APK(s) generated successfully"
```

### **Método 2: Via Terminal (Alternativo)**
No terminal do Android Studio (Alt+F12):
```bash
./gradlew clean assembleDebug
```

**Tempo:** 2-4 minutos

**Local do APK:**
```
android\app\build\outputs\apk\debug\app-debug.apk
```

---

## ✅ **PASSO 6: VERIFICAR APK GERADO**

### **No Windows Explorer:**
```
1. Ir em: android\app\build\outputs\apk\debug\
2. Verificar arquivo: app-debug.apk
3. Ver tamanho: ~20-30 MB
4. Ver data: HOJE (verificar que é novo)
```

**⚠️ Se APK NÃO existir:**
- Ver console do Android Studio para erros
- Tentar Rebuild Project novamente

---

## 📱 **PASSO 7: INSTALAR NO CELULAR**

### **Opção A: USB (Recomendado)**
```
1. Conectar celular no USB
2. Ativar "Depuração USB" no celular
3. Copiar app-debug.apk para celular (Downloads/)
4. No celular: Abrir "Arquivos" > Downloads
5. Tocar em app-debug.apk
6. Permitir instalação de fontes desconhecidas (se pedir)
7. Clicar "Atualizar" ou "Instalar"
```

### **Opção B: WhatsApp/Email**
```
1. Enviar app-debug.apk para próprio WhatsApp
2. Baixar no celular
3. Abrir arquivo
4. Instalar
```

**⚠️ IMPORTANTE:** Escolher **"ATUALIZAR"** (não desinstalar!)

**Por quê?**
- Mantém dados locais (login, configurações)
- Mantém permissões já concedidas
- Instalação mais rápida

---

## ✅ **PASSO 8: CONFIGURAR PERMISSÕES CRÍTICAS**

### **Após instalar:**

**1. Abrir Configurações do celular**
```
Configurações > Apps > MotoHub Delivery
```

**2. Configurar Localização:**
```
Permissões > Localização > "Permitir o tempo todo"
```

**⚠️ CRÍTICO:** Não escolher "Apenas durante uso"!

**3. Configurar Notificações:**
```
Notificações > Ativar tudo
```

**4. Configurar Bateria:**
```
Bateria > "Não otimizar" ou "Irrestrito"
```

**Tempo:** 2 minutos

---

## 🧪 **PASSO 9: TESTE INICIAL**

### **1. Abrir MotoHub no celular**
- Login como motoboy
- Aguardar carregar dashboard

### **2. Clicar "Iniciar Rastreamento"**

### **3. VERIFICAÇÕES IMEDIATAS:**

**✅ Deve acontecer:**
```
1. Notificação "🏍️ MotoHub - GPS Ativo" aparece na barra
2. Notificação é PERSISTENTE (não some por swipe)
3. Dashboard mostra velocidade/localização atualizando
```

**❌ Se NÃO acontecer:**
```
1. Pedir permissão de localização novamente
2. Ver se notificação está bloqueada
3. Verificar se "Localização o tempo todo" está ativo
```

**Tempo:** 1 minuto

---

## 🚗 **PASSO 10: TESTE DE BACKGROUND (CRÍTICO)**

### **Setup:**
```
1. GPS ativo (notificação visível)
2. Em OUTRO dispositivo: Abrir dashboard Admin
3. Abrir mapa de rastreamento
4. Confirmar que motoboy aparece no mapa
```

### **Teste A: Minimizar App**
```
1. No celular: Apertar botão Home
2. Aguardar 10 segundos
3. No dashboard: Verificar se posição continua atualizando
```

**✅ Sucesso:** Posição continua atualizando  
**❌ Falha:** Posição parou (GPS morreu)

### **Teste B: Abrir Waze (DEFINITIVO)**
```
1. Com GPS ativo (notificação visível)
2. Apertar Home
3. Abrir Waze
4. Iniciar navegação para qualquer destino
5. Dirigir/caminhar 500m
6. No dashboard: Verificar se motoboy se move no mapa
```

**✅ Sucesso:** Motoboy se move normalmente  
**❌ Falha:** Motoboy parado (GPS morreu)

### **Teste C: Tela Apagada**
```
1. Com GPS ativo
2. Apertar Power (apagar tela)
3. Aguardar 1 minuto
4. Acender tela
5. Ver dashboard: Posição atualizou?
```

**✅ Sucesso:** Posição atualizou  
**❌ Falha:** Posição parada

**Tempo:** 5-10 minutos

---

## 🔍 **PASSO 11: LOGS DE DIAGNÓSTICO**

### **Se GPS NÃO funcionar em background:**

**Conectar celular no USB e ver logs:**

```
1. Android Studio > Logcat (barra inferior)
2. Filtrar por: "GpsTracking"
3. Limpar logs (ícone 🚫)
4. No celular: Iniciar rastreamento
5. Ver logs em tempo real
```

**Logs de SUCESSO:**
```
I/GpsTrackingService: onCreate() - Serviço iniciado
I/GpsTrackingService: Foreground iniciado
I/GpsTrackingService: Notificação criada
I/GpsTrackingPlugin: GPS Tracking nativo iniciado
📍 Location update do serviço nativo: {...}
```

**Logs de FALHA:**
```
⚠️ Plugin GpsTracking não disponível
E/GpsTrackingService: Permission denied
E/GpsTrackingService: Service failed to start
```

---

## ✅ **CHECKLIST FINAL**

### **Após todos os testes:**

**Build:**
- [ ] Build sem erros
- [ ] APK gerado (20-30 MB)
- [ ] Data do APK é de HOJE

**Instalação:**
- [ ] APK instalado (atualizado, não desinstalado)
- [ ] Permissão "Localização o tempo todo" concedida
- [ ] Permissão "Notificações" concedida
- [ ] Bateria "Não otimizar" configurado

**Funcionamento:**
- [ ] Notificação "GPS Ativo" aparece
- [ ] GPS funciona com app aberto
- [ ] GPS funciona com app minimizado
- [ ] GPS funciona com Waze aberto
- [ ] GPS funciona com tela apagada
- [ ] Posição atualiza no mapa em tempo real

**Se TUDO ✅:** 🎉 **GPS FUNCIONANDO 100%!**

---

## 🚨 **TROUBLESHOOTING**

### **Problema: "Plugin não disponível"**
**Solução:**
```
1. Android Studio > Build > Clean Project
2. Build > Rebuild Project
3. Gerar APK novamente
```

### **Problema: GPS para em background**
**Solução:**
```
1. Verificar permissão "Localização o tempo todo"
2. Desabilitar otimização de bateria
3. Verificar se notificação está visível
4. Reiniciar celular e testar novamente
```

### **Problema: Build falha**
**Solução:**
```
1. Ver mensagem de erro no terminal
2. Executar: npx cap sync android (novamente)
3. Android Studio > File > Invalidate Caches / Restart
4. Tentar build novamente
```

---

## 📞 **SE NADA FUNCIONAR**

**Me envie:**
1. Console output do `pnpm run build`
2. Console output do `npx cap sync android`
3. Logs do Logcat (filtro: GpsTracking)
4. Screenshot da notificação (se aparecer)

---

## ⏱️ **TEMPO TOTAL ESTIMADO**

- Build + Sync: ~3 min
- Android Studio + APK: ~5 min
- Instalação + Testes: ~10 min

**TOTAL: ~20 minutos**

---

_Guia atualizado: 23 de Setembro de 2026_
