# ✅ CHECKLIST - ANDROID STUDIO

## 📋 **SIGA ESTA ORDEM:**

---

### **□ PASSO 1: ABRIR PROJETO**

1. Abra o **Android Studio**
2. Na tela inicial, clique: **Open**
3. Navegue até: `C:\Users\ectli\dyad-apps\moto-hub2026-3-1\android`
4. Clique **OK**
5. **AGUARDE** a sincronização (barra de progresso embaixo)
   - Pode demorar 2-3 minutos
   - Vai aparecer: "Gradle sync in progress..."
   - **NÃO CLIQUE EM NADA** até terminar!

**✅ Pronto quando:** Barra de progresso sumir e aparecer "Gradle sync finished"

---

### **□ PASSO 2: VERIFICAR JAVA 17**

1. Menu: **File → Project Structure** (ou Ctrl+Alt+Shift+S)
2. Na lateral esquerda: **SDK Location**
3. Em **"JDK location"** deve estar algo como:
   ```
   C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot
   ```
4. Se não estiver, clique **...** e selecione esta pasta
5. **Apply → OK**

**✅ Pronto quando:** JDK 17 configurado

---

### **□ PASSO 3: CONFIGURAR GRADLE JDK**

1. Menu: **File → Settings** (ou Ctrl+Alt+S)
2. Navegue: **Build, Execution, Deployment → Build Tools → Gradle**
3. Em **"Gradle JDK":**
   - Clique no dropdown
   - Selecione: **17** ou **jdk-17.0.20.101-hotspot**
   - Se não aparecer, clique em **"Download JDK..."** e baixe versão 17
4. **Apply → OK**

**✅ Pronto quando:** Gradle JDK = 17

---

### **□ PASSO 4: INVALIDAR CACHE** ⚡ IMPORTANTE!

1. Menu: **File → Invalidate Caches / Restart...**
2. Marque: ✅ **Invalidate and Restart**
3. Clique: **Invalidate and Restart**
4. **AGUARDE** Android Studio fechar e reabrir (~1 minuto)
5. **AGUARDE** sincronização automática terminar

**✅ Pronto quando:** Android Studio reabriu e sync terminou

---

### **□ PASSO 5: CLEAN PROJECT**

1. Menu: **Build → Clean Project**
2. **AGUARDE** até aparecer na aba **Build** (embaixo):
   ```
   BUILD SUCCESSFUL in Xs
   ```

**✅ Pronto quando:** "BUILD SUCCESSFUL" aparece

---

### **□ PASSO 6: REBUILD PROJECT**

1. Menu: **Build → Rebuild Project**
2. **AGUARDE** (vai demorar ~3-5 minutos)
3. Acompanhe o progresso:
   - Barra embaixo mostra progresso
   - Aba **Build** mostra logs
4. **AGUARDE** até aparecer:
   ```
   BUILD SUCCESSFUL in X min Xs
   ```

**✅ Pronto quando:** "BUILD SUCCESSFUL" aparece

---

### **□ PASSO 7: BUILD APK** 🎯

1. Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. **AGUARDE** (~2-3 minutos)
3. Vai aparecer uma **notificação** no canto inferior direito:
   ```
   APK(s) generated successfully
   ```
4. Clique no link **"locate"** na notificação

**✅ Pronto quando:** Pasta do APK aberta!

---

## 📱 **PASSO 8: COPIAR APK PARA CELULAR**

O APK está em:
```
C:\Users\ectli\dyad-apps\moto-hub2026-3-1\android\app\build\outputs\apk\debug\app-debug.apk
```

**Como copiar:**
- Por WhatsApp (enviar arquivo para você mesmo)
- Por email
- Por USB (copiar para pasta Downloads do celular)
- Por cloud (Google Drive, Dropbox...)

---

## 📲 **PASSO 9: INSTALAR NO CELULAR**

1. No celular, abra o arquivo **app-debug.apk**
2. Se pedir, habilite **"Instalar apps de fontes desconhecidas"**
3. Clique **Instalar**
4. Aguarde instalação
5. Clique **Abrir**

---

## 🔐 **PASSO 10: CONFIGURAR PERMISSÕES**

1. App vai pedir permissões:
   - ✅ **Localização: "Permitir o tempo todo"** ← ESSENCIAL!
   - ✅ **Notificações: "Permitir"**
2. Vá em **Configurações do Android → Apps → MotoHub:**
   - ✅ Localização: "Permitir o tempo todo"
   - ✅ Notificações: "Permitir"
   - ✅ Bateria: "Não otimizar" (se disponível)

---

## 🧪 **PASSO 11: TESTAR GPS BACKGROUND**

1. Abra o app
2. Faça login como **motoboy**
3. Clique **"Iniciar Rastreamento"**
4. **VERIFIQUE:** Apareceu notificação "GPS Ativo" na barra? ✅
5. **Minimize** o app (botão home)
6. **Abra outro app** (Waze, Google Maps, Chrome...)
7. **Use o celular normalmente** por 5-10 minutos
8. **No admin/estabelecimento:** veja se a posição está atualizando!

---

## 🆘 **SE DER ERRO NO ANDROID STUDIO:**

### **Erro: "Gradle sync failed"**
- **Solução:** File → Sync Project with Gradle Files
- Aguarde e tente rebuild

### **Erro: "Out of memory"**
- **Solução:** 
  1. File → Settings
  2. Build, Execution, Deployment → Compiler
  3. Build process heap size: **2048**
  4. Apply → OK
  5. Invalidate Caches novamente

### **Erro: "SDK not found"**
- **Solução:**
  1. File → Project Structure → SDK Location
  2. Verifique se Android SDK está configurado
  3. Se não, clique em "Edit" e instale

### **Build trava/congela**
- **Solução:**
  1. Feche Android Studio
  2. Mate processos: Task Manager → Processos Java
  3. Reabra Android Studio
  4. Tente novamente

---

## ⏱️ **TEMPO ESTIMADO POR PASSO:**

| Passo | Tempo |
|-------|-------|
| 1. Abrir projeto | 2-3 min |
| 2. Verificar Java | 30 seg |
| 3. Configurar Gradle | 1 min |
| 4. Invalidar cache | 2 min |
| 5. Clean | 1 min |
| 6. Rebuild | 3-5 min |
| 7. Build APK | 2-3 min |
| **TOTAL** | **~15 minutos** |

---

## ✅ **STATUS FINAL:**

Quando terminar, você terá:
- ✅ APK compilado com Java 17
- ✅ GPS background nativo funcionando
- ✅ Rastreamento continua com app minimizado
- ✅ Funciona junto com Waze/Maps
- ✅ Notificação persistente na barra

---

## 📞 **ME AVISE QUANDO:**

- ✅ Conseguiu abrir o projeto no Android Studio
- ✅ Build successful no passo 6
- ✅ APK gerado no passo 7
- ❌ Se der qualquer erro, mande print ou mensagem do erro

---

**BOA SORTE! 🚀**

Comece agora pelo **PASSO 1** e vá marcando os checkboxes conforme avança!
