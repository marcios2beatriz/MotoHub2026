# ⚡ TESTE RÁPIDO - ADB

## 🎯 **OBJETIVO**

Verificar se ADB consegue ver seu celular, sem precisar do Android Studio.

---

## 🚀 **PASSO A PASSO**

### **1. Abrir PowerShell**

```
Win + R → digite: powershell → Enter
```

---

### **2. Navegar para pasta platform-tools**

```powershell
cd "C:\Users\ectli\AppData\Local\Android\Sdk\platform-tools"
```

**Se der erro "não encontrado":**
```powershell
# Tentar caminho alternativo
cd "C:\Users\ectli\AppData\Local\Android\sdk\platform-tools"
```

**Se ainda não encontrar:**
```powershell
# Procurar onde está instalado
dir "C:\Users\ectli\AppData\Local\Android\" /s /b | findstr platform-tools
```

---

### **3. Listar dispositivos**

```powershell
.\adb devices
```

---

## ✅ **RESULTADOS POSSÍVEIS**

### **RESULTADO 1: Dispositivo reconhecido (SUCESSO!)**

```
List of devices attached
1234567890ABC    device
```

✅ **Celular está conectado e autorizado!**

**Próximo passo:**
- Reiniciar Android Studio
- Abrir Logcat
- Dispositivo deve aparecer

---

### **RESULTADO 2: Não autorizado**

```
List of devices attached
1234567890ABC    unauthorized
```

❌ **Celular conectado mas não autorizou depuração USB**

**Solução:**
1. Olhar no celular
2. Deve ter pop-up "Permitir depuração USB?"
3. ✅ Marcar "Sempre permitir neste computador"
4. Clicar "PERMITIR"
5. Rodar comando novamente: `.\adb devices`

---

### **RESULTADO 3: Lista vazia**

```
List of devices attached

```

❌ **Celular não está sendo reconhecido**

**Causas possíveis:**

**A. USB Debugging não está ativado**
```
Celular → Configurações → Opções do desenvolvedor
→ Ativar "Depuração USB" ✅
```

**B. Cabo USB só carrega (não transmite dados)**
```
Testar com outro cabo USB
```

**C. Porta USB do PC com problema**
```
Trocar porta USB
```

**D. Modo USB errado**
```
Celular → Barra de notificações
→ Tocar em "USB para transferência de arquivos"
→ Selecionar "Transferir arquivos (MTP)"
```

---

### **RESULTADO 4: Erro "adb não reconhecido"**

```
adb : O termo 'adb' não é reconhecido...
```

❌ **ADB não está instalado ou caminho errado**

**Solução A - Instalar Android SDK Platform Tools:**
```
1. Baixar: https://developer.android.com/studio/releases/platform-tools
2. Extrair ZIP em pasta conhecida (ex: C:\adb)
3. Adicionar ao PATH do Windows
```

**Solução B - Usar ADB do Android Studio:**
```
# No PowerShell, rodar comando completo:
& "C:\Users\ectli\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices
```

---

## 🔄 **COMANDOS ÚTEIS ADB**

### **Reiniciar servidor ADB:**
```powershell
.\adb kill-server
.\adb start-server
.\adb devices
```

### **Ver logs em tempo real (sem Android Studio):**
```powershell
.\adb logcat -s GpsTrackingService:D GpsTrackingPlugin:D
```

**Para parar:** `Ctrl + C`

### **Ver TODOS os logs:**
```powershell
.\adb logcat
```
**Atenção:** Vai aparecer MUITA coisa!

### **Limpar buffer de logs:**
```powershell
.\adb logcat -c
```

### **Ver apenas erros:**
```powershell
.\adb logcat *:E
```

### **Salvar logs em arquivo:**
```powershell
.\adb logcat -s GpsTrackingService:D > logs_gps.txt
```
Depois de alguns minutos: `Ctrl + C`  
Arquivo `logs_gps.txt` vai estar na mesma pasta.

---

## 🧪 **TESTE COMPLETO COM LOGS**

### **1. Preparar:**
```powershell
cd "C:\Users\ectli\AppData\Local\Android\Sdk\platform-tools"
.\adb devices
# Verificar que celular aparece como "device"
```

### **2. Limpar logs antigos:**
```powershell
.\adb logcat -c
```

### **3. Iniciar captura de logs:**
```powershell
.\adb logcat -s GpsTrackingService:D GpsTrackingPlugin:D
```

### **4. No celular:**
```
1. Abrir MotoHub
2. Login como motoboy
3. Aguardar GPS iniciar
```

### **5. Observar logs no PowerShell:**

Deve aparecer em tempo real:
```
D/GpsTrackingPlugin: startTracking() called
D/GpsTrackingService: onCreate() called
D/GpsTrackingService: ✅ WakeLock acquired
D/GpsTrackingService: onStartCommand() called
D/GpsTrackingService: ✅ startForeground() executado
...
```

### **6. Testar minimizar:**
```
1. No celular: minimizar app (Home)
2. Aguardar 1-2 minutos
3. Ver se logs continuam aparecendo no PowerShell
```

### **7. Parar captura:**
```
Ctrl + C no PowerShell
```

---

## 📊 **SALVAR LOGS E ENVIAR**

### **Opção 1: Salvar em arquivo**
```powershell
.\adb logcat -s GpsTrackingService:D GpsTrackingPlugin:D > C:\Users\ectli\Desktop\logs_motohub.txt
```

Deixe rodando por 5-10 minutos enquanto usa o app.

Depois: `Ctrl + C`

Arquivo vai estar na área de trabalho: `logs_motohub.txt`

---

### **Opção 2: Copiar direto**
```powershell
.\adb logcat -s GpsTrackingService:D GpsTrackingPlugin:D -d
```

Opção `-d` mostra logs e para automaticamente.

Copie a saída e cole aqui.

---

## 🎯 **O QUE PROCURAR NOS LOGS**

### **✅ GPS funcionando corretamente:**
```
D/GpsTrackingService: onCreate() called
D/GpsTrackingService: ✅ WakeLock acquired
D/GpsTrackingService: WakeLock held: true
D/GpsTrackingService: 📍 Location received: lat=-23.xxxxx
D/GpsTrackingService: ✅ Update: distance=12.5m
```

Logs aparecem continuamente a cada 5s.

---

### **❌ GPS para (PROBLEMA):**

**Logs param de aparecer:**
```
D/GpsTrackingService: 📍 Location received...
D/GpsTrackingService: 📍 Location received...
D/GpsTrackingService: 📍 Location received...
(silêncio... nada mais aparece)
```

Isso significa que sistema matou o serviço SEM chamar onTaskRemoved.

---

### **⚠️ App fechado mas restarting:**
```
D/GpsTrackingService: ⚠️ onTaskRemoved() - App foi fechado
D/GpsTrackingService: ✅ Restart agendado para 1s
... (1 segundo) ...
D/GpsTrackingService: onCreate() called
D/GpsTrackingService: onStartCommand() called - RESTART
```

Isso significa que auto-restart está funcionando! ✅

---

### **❌ Erro de permissão:**
```
E/GpsTrackingPlugin: Location permission denied
E/GpsTrackingService: SecurityException: Location permission not granted
```

Verificar permissões do app.

---

### **❌ WakeLock não foi adquirido:**
```
D/GpsTrackingService: onCreate() called
D/GpsTrackingService: WakeLock held: false
```

Problema no código, rebuild necessário.

---

## 📞 **ME ENVIE**

Depois de fazer teste:

1. Resultado de `.\adb devices`
2. Logs capturados (arquivo ou copiar/colar)
3. Quanto tempo GPS ficou ativo antes de parar?
4. Viu "onTaskRemoved" nos logs?
5. Viu "WakeLock held: true"?

Com os logs eu consigo diagnosticar EXATAMENTE o que está acontecendo!

---

**Tempo:** 5-10 minutos  
**Mais fácil que Android Studio:** SIM ✅  
**Mostra mesmos logs:** SIM ✅  
