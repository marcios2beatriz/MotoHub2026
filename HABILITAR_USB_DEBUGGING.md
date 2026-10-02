# 🔌 HABILITAR USB DEBUGGING - ANDROID STUDIO

## 📱 **PROBLEMA**

Android Studio não reconhece dispositivo no Logcat, mas Windows reconhece o celular.

**Causa:** USB Debugging não está ativado ou drivers ADB não instalados.

---

## ✅ **SOLUÇÃO - PASSO A PASSO**

### **PARTE 1: HABILITAR USB DEBUGGING NO CELULAR** (2 min)

#### **Passo 1: Ativar Modo Desenvolvedor**

```
1. Abrir Configurações
2. Sobre o telefone (ou Sistema)
3. Procurar "Número da versão" ou "Versão do software"
4. Tocar 7 VEZES seguidas em "Número da versão"
5. Vai aparecer: "Você agora é um desenvolvedor!"
```

#### **Passo 2: Ativar USB Debugging**

```
1. Voltar para Configurações
2. Sistema → Opções do desenvolvedor
   (ou direto em Configurações → Opções do desenvolvedor)
3. Ativar: "Opções do desenvolvedor" ✅
4. Ativar: "Depuração USB" ✅
5. Ativar: "Instalar via USB" ✅ (se disponível)
```

**Vivo específico:**
```
Pode estar em:
Configurações → Mais configurações → Opções do desenvolvedor
```

#### **Passo 3: Conectar USB**

```
1. Conectar celular no PC via cabo USB
2. No celular, vai aparecer pop-up:
   "Permitir depuração USB?"
   Computador: RSAKEY:xxxxx...
3. ✅ Marcar: "Sempre permitir neste computador"
4. Clicar: "PERMITIR"
```

**⚠️ Se não aparecer pop-up:**
```
1. Desconectar cabo USB
2. Configurações → Opções desenvolvedor → Revogar autorizações
3. Reconectar cabo USB
4. Pop-up deve aparecer agora
```

---

### **PARTE 2: CONFIGURAR CONEXÃO USB NO CELULAR** (1 min)

Ao conectar USB, na **barra de notificações** aparece:

```
"Carregando este dispositivo via USB"
ou
"USB para transferência de arquivos"
```

**Tocar na notificação e selecionar:**
```
⚪ Transferir arquivos
⚪ Transferir fotos (PTP)
🔵 USB tethering / Compartilhar conexão ← Pode funcionar
🔵 MTP (Media Transfer Protocol)
```

**OU configurar manualmente:**
```
Configurações → Conexões USB (ou Conectar ao PC)
→ Selecionar: "Transferir arquivos (MTP)"
```

---

### **PARTE 3: INSTALAR DRIVERS ADB NO WINDOWS** (5 min)

#### **Opção A: Drivers Universais Google (RECOMENDADO)**

```
1. Baixar Google USB Driver:
   https://developer.android.com/studio/run/win-usb

2. Extrair arquivo ZIP

3. Abrir Gerenciador de Dispositivos do Windows:
   - Apertar Win + X
   - Selecionar "Gerenciador de Dispositivos"

4. Procurar dispositivo com ⚠️ (aviso amarelo)
   Pode estar em:
   - "Outros dispositivos" → Android
   - "Dispositivos portáteis" → Nome do celular

5. Clicar com botão direito → "Atualizar driver"

6. "Procurar drivers no computador"

7. "Permitir que eu escolha em uma lista"

8. "Com disco..." → Procurar pasta extraída → Selecionar "android_winusb.inf"

9. Instalar → Pode aparecer aviso de segurança → "Instalar mesmo assim"

10. Concluir
```

#### **Opção B: Drivers Vivo Específicos**

```
1. Acessar site Vivo:
   https://www.vivo.com/en/support/downloads

2. Procurar modelo do seu celular

3. Baixar "USB Driver" específico

4. Instalar executável

5. Reiniciar PC
```

#### **Opção C: Usar Platform Tools Diretamente**

```
Android Studio já tem ADB instalado:

1. Abrir terminal (PowerShell) no Windows

2. Navegar para pasta platform-tools do Android Studio:
   cd "C:\Users\ectli\AppData\Local\Android\Sdk\platform-tools"

3. Testar comando:
   .\adb devices

4. Se aparecer lista vazia ou "unauthorized":
   .\adb kill-server
   .\adb start-server
   .\adb devices

5. No celular deve aparecer pop-up de autorização
```

---

### **PARTE 4: VERIFICAR CONEXÃO** (1 min)

#### **No Terminal/PowerShell:**

```powershell
cd "C:\Users\ectli\AppData\Local\Android\Sdk\platform-tools"
.\adb devices
```

**Resultado ESPERADO:**
```
List of devices attached
ABC123XYZ    device
```

**Se aparecer "unauthorized":**
```
ABC123XYZ    unauthorized
```
→ No celular, aceitar pop-up "Permitir depuração USB"

**Se aparecer lista vazia:**
```
List of devices attached
(vazio)
```
→ Problema de driver ou cabo USB

---

### **PARTE 5: REINICIAR ANDROID STUDIO** (1 min)

```
1. Fechar Android Studio completamente
2. Desconectar celular
3. Abrir Android Studio
4. Reconectar celular
5. View → Tool Windows → Logcat
6. Na aba Logcat, clicar no dropdown "No connected devices"
7. Dispositivo deve aparecer agora!
```

---

## 🧪 **TESTAR LOGCAT**

### **Teste 1: Filtrar por app**

```
1. Logcat aberto
2. Filtro (caixa de busca): package:com.motohub.delivery
3. Abrir MotoHub no celular
4. Logs devem começar a aparecer
```

### **Teste 2: Filtrar por tag**

```
1. Filtro: tag:GpsTrackingService
2. Fazer login como motoboy no app
3. GPS deve iniciar
4. Logs devem aparecer:
   D/GpsTrackingService: onCreate() called
   D/GpsTrackingService: ✅ WakeLock acquired
```

---

## 🐛 **TROUBLESHOOTING**

### **Problema 1: "No connected devices" continua**

**Solução A - Revogar e reconectar:**
```
1. Celular: Configurações → Opções desenvolvedor
2. "Revogar autorizações de depuração USB"
3. Desconectar cabo
4. Reconectar
5. Aceitar pop-up
```

**Solução B - Matar processo ADB:**
```powershell
cd "C:\Users\ectli\AppData\Local\Android\Sdk\platform-tools"
.\adb kill-server
.\adb start-server
.\adb devices
```

**Solução C - Reinstalar drivers:**
```
1. Gerenciador de Dispositivos
2. Encontrar dispositivo Android
3. Botão direito → Desinstalar dispositivo
4. ✅ Marcar "Excluir software de driver"
5. Desinstalar
6. Desconectar e reconectar cabo
7. Windows vai reinstalar driver automaticamente
```

---

### **Problema 2: Dispositivo aparece mas sem logs**

**Causa:** App não está gerando logs ou filtro muito restritivo

**Solução:**
```
1. Limpar filtros do Logcat (X no filtro)
2. Selecionar level: "Debug" ou "Verbose"
3. Abrir app no celular
4. Deve aparecer MUITOS logs
5. Aplicar filtro novamente: tag:GpsTrackingService
```

---

### **Problema 3: "unauthorized" persiste**

**Solução:**
```
1. Desativar "Depuração USB"
2. Desconectar cabo
3. Reativar "Depuração USB"
4. Reconectar cabo
5. Pop-up deve aparecer novamente
```

---

### **Problema 4: Cabo USB não funciona**

**Teste:**
```
1. Trocar porta USB do PC
2. Tentar cabo USB diferente
3. Alguns cabos só carregam, não transmitem dados
```

---

## 📊 **LOGS ESPERADOS APÓS CONFIGURAR**

Após fazer login como motoboy:

```
D/GpsTrackingPlugin: startTracking() called
D/GpsTrackingPlugin: All permissions granted
D/GpsTrackingPlugin: Starting GPS service...
D/GpsTrackingService: =====================================
D/GpsTrackingService: onCreate() called
D/GpsTrackingService: ✅ WakeLock acquired
D/GpsTrackingService: onStartCommand() called
D/GpsTrackingService: ✅ startForeground() executado
D/GpsTrackingService: WakeLock held: true
D/GpsTrackingService: Iniciando location updates...
D/GpsTrackingService: ✅ Location updates iniciados
D/GpsTrackingService: 📍 Localização inicial: lat=-23.xxxxx
D/GpsTrackingService: ✅ Serviço completamente inicializado!
D/GpsTrackingService: =====================================
```

**A cada 5 segundos (quando se move):**
```
D/GpsTrackingService: 📍 Location received: lat=-23.xxxxx, lng=-46.xxxxx
D/GpsTrackingService: ✅ Update: distance=12.5m, timeDiff=5s
D/GpsTrackingService: ✅ Location sent to JS
```

**Se fechar app da lista de recentes:**
```
D/GpsTrackingService: ⚠️ onTaskRemoved() - App foi fechado
D/GpsTrackingService: ✅ Restart agendado para 1s
... (1 segundo depois) ...
D/GpsTrackingService: onCreate() called
D/GpsTrackingService: onStartCommand() called - RESTART
```

**Se GPS parar (problema!):**
```
(logs param de aparecer, silêncio)
```
→ Aí vamos diagnosticar o problema!

---

## 🎯 **CHECKLIST RÁPIDO**

Antes de dizer que não funciona:

**No celular:**
- [ ] Modo desenvolvedor ativado ✅
- [ ] "Depuração USB" ativada ✅
- [ ] Pop-up "Permitir depuração" aceito ✅
- [ ] "Sempre permitir neste computador" marcado ✅
- [ ] Modo USB: "Transferir arquivos" ou "MTP" ✅

**No Windows:**
- [ ] Drivers instalados (adb devices funciona) ✅
- [ ] Android Studio reiniciado após conectar ✅
- [ ] Dispositivo aparece no Logcat ✅

**No Android Studio:**
- [ ] Logcat aberto (View → Tool Windows → Logcat) ✅
- [ ] Dispositivo selecionado no dropdown ✅
- [ ] Filtro: tag:GpsTrackingService ✅
- [ ] App aberto no celular ✅

---

## 📞 **DEPOIS DE CONFIGURAR**

Me envie:

1. ✅ `adb devices` reconhece celular? SIM / NÃO
2. ✅ Logcat mostra dispositivo? SIM / NÃO
3. ✅ Aparecem logs do GpsTrackingService? SIM / NÃO
4. ✅ Se sim, quanto tempo ficam aparecendo antes de parar?
5. ✅ Se não, algum erro aparece?

**Pode enviar screenshot ou copiar/colar os logs aqui!**

---

**Tempo total:** 10-15 minutos  
**Dificuldade:** Médio (várias etapas)  
**Resultado:** Logs em tempo real do que está acontecendo  
