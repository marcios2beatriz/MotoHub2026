# ☕ INSTALAR JAVA 11 - PASSO A PASSO

## 🚨 **PROBLEMA ATUAL**

Seu sistema tem **Java 8**, mas o projeto precisa de **Java 11+** para compilar o APK.

**Erro:**
```
Dependency requires at least JVM runtime version 11.
This build uses a Java 8 JVM.
```

**Java instalado atualmente:**
```
C:\Program Files (x86)\Java\jre1.8.0_441
```

---

## ✅ **SOLUÇÃO: INSTALAR JAVA 17 (RECOMENDADO)**

Vou te guiar para instalar Java 17 (LTS - suporte de longo prazo).

---

## 📥 **PASSO 1: BAIXAR JAVA 17**

### **Opção A: Eclipse Temurin (RECOMENDADO)**

1. **Abra este link no navegador:**
   ```
   https://adoptium.net/temurin/releases/?version=17
   ```

2. **Selecione:**
   - **Operating System:** Windows
   - **Architecture:** x64
   - **Package Type:** JDK
   - **Version:** 17 - LTS

3. **Clique no botão:** `.msi` (installer)

4. **Aguarde o download** (~100 MB)

---

### **Opção B: Oracle JDK (Alternativa)**

1. **Abra este link:**
   ```
   https://www.oracle.com/java/technologies/javase/jdk17-archive-downloads.html
   ```

2. **Baixe:** Windows x64 Installer

---

## 💾 **PASSO 2: INSTALAR**

1. **Execute o arquivo** `.msi` baixado

2. **Siga o instalador:**
   - ✅ Aceite os termos
   - ✅ Deixe o caminho padrão (C:\Program Files\Eclipse Adoptium\...)
   - ✅ Marque: "Set JAVA_HOME variable"
   - ✅ Marque: "Add to PATH"
   - ✅ Clique "Install"

3. **Aguarde** instalação (~2 minutos)

4. **Clique "Finish"**

---

## 🔧 **PASSO 3: VERIFICAR INSTALAÇÃO**

1. **Feche TODOS** programas Java/Android Studio

2. **Abra novo terminal** (PowerShell ou CMD)

3. **Execute:**
   ```
   java -version
   ```

4. **Deve aparecer:**
   ```
   openjdk version "17.0.x"
   OpenJDK Runtime Environment Temurin-17+x
   ```

---

## 🎯 **PASSO 4: CONFIGURAR ANDROID STUDIO**

### **Se você usa Android Studio:**

1. **Abra Android Studio**

2. **Vá em:** File → Settings

3. **Navegue:** Build, Execution, Deployment → Build Tools → Gradle

4. **Em "Gradle JDK":**
   - Clique no dropdown
   - Selecione: **Java 17** (se não aparecer, clique "Add JDK" e navegue até C:\Program Files\Eclipse Adoptium\jdk-17...)

5. **Clique:** Apply → OK

6. **Feche e reabra** Android Studio

---

## 🚀 **PASSO 5: GERAR O APK**

Agora sim vai funcionar!

### **Pelo terminal:**

```bash
cd android
./gradlew clean assembleDebug
```

### **Ou pelo Android Studio:**

1. Build → Clean Project
2. Build → Rebuild Project
3. Build → Build APK(s)

---

## 📂 **CAMINHO DO APK**

Depois que compilar com sucesso:

```
android\app\build\outputs\apk\debug\app-debug.apk
```

---

## ⚠️ **SE AINDA DER ERRO**

### **Limpar cache do Gradle:**

```bash
# No PowerShell (na pasta raiz do projeto)
Remove-Item -Recurse -Force android\.gradle
Remove-Item -Recurse -Force $env:USERPROFILE\.gradle\caches
```

Depois tente compilar novamente.

---

## 🆘 **AJUDA EXTRA**

### **Verificar JAVA_HOME:**

```bash
echo $env:JAVA_HOME
```

**Deve mostrar algo como:**
```
C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot
```

### **Se JAVA_HOME estiver errado:**

1. Abra: Painel de Controle → Sistema → Configurações avançadas do sistema
2. Clique: Variáveis de Ambiente
3. Em "Variáveis do sistema", procure `JAVA_HOME`
4. Edite para: `C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot`
5. Reinicie o terminal

---

## ✅ **CHECKLIST**

- [ ] Java 17 baixado
- [ ] Java 17 instalado
- [ ] Terminal reiniciado
- [ ] `java -version` mostra versão 17
- [ ] Android Studio configurado (se usar)
- [ ] Cache limpo
- [ ] APK compilado com sucesso!

---

## 🎉 **DEPOIS DE INSTALAR JAVA 17**

Execute o BAT novamente:
```
GERAR_APK_AGORA.bat
```

Ou compile pelo Android Studio!

---

**Status:** 🔴 Java 8 instalado (BLOQUEANDO)
**Precisa:** ☕ Java 11+ (Java 17 recomendado)
**Tempo:** ⏱️ 10 minutos para instalar
