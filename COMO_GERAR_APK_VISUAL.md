# 📱 COMO GERAR O APK - GUIA VISUAL

## 🎯 PROBLEMA ATUAL

Você executou um BAT mas **o APK não foi gerado** porque o Java ficou sem memória.

---

## ✅ SOLUÇÃO: 2 OPÇÕES

---

## 🚀 OPÇÃO 1: USAR NOVO BAT (MAIS FÁCIL)

### **Passo a passo:**

1. **Feche** todos programas pesados (Chrome, etc)

2. **Clique duas vezes** no arquivo:
   ```
   GERAR_APK_AGORA.bat
   ```
   *(está na pasta raiz do projeto)*

3. **Aguarde** ~5 minutos (vai aparecer muito texto)

4. **Quando terminar**, o caminho do APK vai aparecer:
   ```
   c:\Users\ectli\dyad-apps\moto-hub2026-3-1\android\app\build\outputs\apk\debug\app-debug.apk
   ```

5. **Copie esse arquivo** para o celular!

---

## 🎨 OPÇÃO 2: PELO ANDROID STUDIO (MAIS CONFIÁVEL)

### **Passo a passo com MENUS:**

#### 1️⃣ **Abrir Android Studio**

- Abra o Android Studio
- Se pedir para abrir projeto, escolha a pasta:
  ```
  c:\Users\ectli\dyad-apps\moto-hub2026-3-1\android
  ```
- **Aguarde** carregar (barra de progresso embaixo)

---

#### 2️⃣ **Limpar cache (IMPORTANTE!)**

- Menu superior: **File**
- Clique em: **Invalidate Caches / Restart...**
- Na janela que abrir: clique **Invalidate and Restart**
- **Aguarde** reabrir (~1 minuto)

---

#### 3️⃣ **Rebuild do projeto**

- Menu superior: **Build**
- Clique em: **Rebuild Project**
- **Aguarde** aparecer "BUILD SUCCESSFUL" embaixo (~3 minutos)

---

#### 4️⃣ **Gerar APK**

- Menu superior: **Build**
- Clique em: **Build Bundle(s) / APK(s)**
- Clique em: **Build APK(s)**
- **Aguarde** aparecer notificação de sucesso (~2 minutos)

---

#### 5️⃣ **Localizar APK**

Quando aparecer a notificação:
```
APK(s) generated successfully
```

- Clique no link **locate** na notificação
- **OU** navegue manualmente:
  ```
  android\app\build\outputs\apk\debug\app-debug.apk
  ```

---

## 📂 COMO ENCONTRAR O APK MANUALMENTE

### **No explorador de arquivos:**

1. Abra a pasta do projeto
2. Entre em `android`
3. Entre em `app`
4. Entre em `build`
5. Entre em `outputs`
6. Entre em `apk`
7. Entre em `debug`
8. **O APK está aqui:** `app-debug.apk`

### **Caminho completo:**
```
c:\Users\ectli\dyad-apps\moto-hub2026-3-1\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 🔧 SE O APK NÃO EXISTIR

A pasta `build` só aparece **DEPOIS** de fazer o build com sucesso!

**Se não aparece:**
- O build falhou (veja erros no Android Studio)
- Precisa fazer Rebuild Project primeiro

---

## 📱 PRÓXIMOS PASSOS APÓS TER O APK

1. **Copie** o arquivo `app-debug.apk` para o celular
2. **No celular:** abra o arquivo
3. **Instale** (pode pedir para habilitar "Fontes desconhecidas")
4. **Abra** o app
5. **Permita** "Localização o tempo todo"
6. **Permita** "Notificações"
7. **Teste** o rastreamento!

---

## ⚠️ IMPORTANTE SOBRE INSTALAR

### **Primeira instalação:**
- Só instala normalmente

### **Atualização (já tem app instalado):**
- **MELHOR:** Sobrescrever (manter dados)
- **Alternativa:** Desinstalar e instalar novo (perde dados locais)

**Recomendo:** Sobrescrever!

---

## 🆘 SE DER ERRO

### **Erro de memória:**
```
Could not reserve enough space for object heap
```
**Solução:** Use o novo BAT que criei (GERAR_APK_AGORA.bat)

### **Erro de Java 8:**
```
Dependency requires at least JVM runtime version 11
```
**Solução:** Precisa instalar Java 11+ (veja INSTALACAO_JAVA.md)

### **Build falhou:**
**Solução:** 
1. Android Studio > File > Invalidate Caches
2. Build > Clean Project
3. Build > Rebuild Project
4. Build > Build APK(s)

---

## ✅ RESUMO

### **Caminho mais rápido:**
1. Execute: `GERAR_APK_AGORA.bat`
2. Aguarde 5 minutos
3. Copie o APK para o celular
4. Instale e teste!

### **Se der erro:**
1. Use Android Studio (Opção 2)
2. Siga os passos com menus
3. Aguarde aparecer notificação de sucesso
4. Localize o APK
5. Copie para celular e teste!

---

**Status:** 🟡 APK ainda não foi gerado (build falhou)
**Próximo passo:** Executar GERAR_APK_AGORA.bat
