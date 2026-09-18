# 📱 GUIA: GERAR NOVO APK ANDROID

## 🚀 Passo a passo para compilar o app com as melhorias

---

## ✅ **PASSO 1: BUILD DO PROJETO**

```bash
# Compilar o projeto web
pnpm run build
```

**O que acontece:**
- Compila TypeScript → JavaScript
- Gera bundle otimizado em `/dist`
- Minifica assets para produção

---

## ✅ **PASSO 2: SINCRONIZAR COM CAPACITOR**

```bash
# Sincroniza o build web com o projeto Android
npx cap sync android
```

**O que acontece:**
- Copia arquivos de `/dist` para Android
- Atualiza plugins do Capacitor
- Aplica novas configurações (GPS, notificações)
- Adiciona novas permissões

---

## ✅ **PASSO 3: ABRIR NO ANDROID STUDIO**

```bash
# Abre o projeto Android no Android Studio
npx cap open android
```

**Ou manualmente:**
- Abra Android Studio
- File → Open
- Selecione a pasta `android/` do projeto

---

## ✅ **PASSO 4: BUILD NO ANDROID STUDIO**

### 📱 **Opção A: APK de Debug (Rápido)**

1. No Android Studio:
   - Menu: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Aguarde a compilação (~2-5 minutos)
3. Clique em "locate" quando aparecer a notificação
4. APK estará em: `android/app/build/outputs/apk/debug/app-debug.apk`

### 🏆 **Opção B: APK de Release (Produção)**

1. No Android Studio:
   - Menu: **Build** → **Generate Signed Bundle / APK**
   - Selecione **APK**
   - Clique **Next**
2. Configure keystore (primeira vez):
   - Clique "Create new..."
   - Escolha local para salvar o keystore
   - Preencha senhas e informações
   - **IMPORTANTE:** Guarde essas informações!
3. Selecione **release** como build variant
4. Clique **Finish**
5. APK estará em: `android/app/release/app-release.apk`

---

## 📲 **PASSO 5: INSTALAR NO DISPOSITIVO**

### **Via cabo USB:**

```bash
# Instalar APK via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### **Via transferência:**

1. Copie o APK para o celular
2. Abra o arquivo no celular
3. Permita "Instalar de fontes desconhecidas"
4. Toque em "Instalar"

---

## ⚙️ **CONFIGURAÇÕES IMPORTANTES NO DISPOSITIVO**

### 🔋 **1. Otimização de Bateria**

**Após instalar, configure:**

1. Configurações → Apps → MotoHub Delivery
2. Bateria → **Sem restrições**
3. Ou: **Permitir execução em segundo plano**

### 📍 **2. Permissões de Localização**

**Durante primeira execução:**

1. App vai pedir permissão de localização
2. **IMPORTANTE:** Escolha **"Permitir o tempo todo"**
3. Necessário para GPS funcionar em background

**Se não aparecer:**

1. Configurações → Apps → MotoHub Delivery
2. Permissões → Localização
3. Selecione: **"Permitir o tempo todo"**

### 🔔 **3. Permissões de Notificação**

1. Configurações → Apps → MotoHub Delivery
2. Notificações → **Ativar**
3. Permita todos os tipos de notificação

---

## 🧪 **TESTAR AS MELHORIAS**

### ✅ **Teste 1: GPS em Background**

1. Faça login como motoboy
2. Inicie uma navegação
3. **Minimize o app** (botão home)
4. Abra Waze ou Google Maps
5. No navegador web, acesse como estabelecimento
6. Verifique se a localização do motoboy continua atualizando

**Resultado esperado:** ✅ Motoboy continua sendo rastreado

---

### ✅ **Teste 2: GPS com Tela Apagada**

1. Motoboy em navegação ativa
2. **Apague a tela** do celular
3. Aguarde 1-2 minutos
4. Acenda a tela
5. Verifique se GPS continuou ativo

**Resultado esperado:** ✅ GPS não perdeu a localização

---

### ✅ **Teste 3: Notificações de Escala**

1. No desktop, faça login como admin
2. Crie uma nova escala para um motoboy
3. No celular do motoboy, minimize o app
4. Aguarde alguns segundos

**Resultado esperado:** ✅ Notificação aparece na barra de status

---

### ✅ **Teste 4: Notificações de Chat**

1. Motoboy envia mensagem para estabelecimento
2. No desktop, estabelecimento deve receber notificação
3. Estabelecimento responde
4. Motoboy deve receber notificação no celular

**Resultado esperado:** ✅ Ambos recebem notificações

---

## ❗ **PROBLEMAS COMUNS**

### **Problema: GPS não funciona em background**

**Solução:**
1. Verifique permissões: "Permitir o tempo todo"
2. Desabilite otimização de bateria do app
3. Em alguns Xiaomi/Huawei: permitir "Auto-start"

### **Problema: Notificações não aparecem**

**Solução:**
1. Verifique se notificações estão ativadas nas configurações
2. Reabra o app e aceite as permissões
3. Teste com app em foreground primeiro

### **Problema: Build falha no Android Studio**

**Solução:**
```bash
# Limpar build anterior
cd android
./gradlew clean

# Voltar e tentar novamente
cd ..
npx cap sync android
```

---

## 📊 **VERIFICAR VERSÃO DO APK**

Para confirmar que o novo APK tem as melhorias:

1. Instale o APK
2. Faça login como motoboy
3. Abra o console do navegador (inspecionar)
4. Procure por logs:
   - `🔄 Realtime conectado: GPS + Notificações ativas`
   - `📱 GPS Worker: Modo background ativo`
   - `📍 Background GPS: X.Xm moved, Xs elapsed`

**Se ver esses logs:** ✅ Novo APK funcionando corretamente!

---

## 🎉 **PRONTO!**

Seu APK está compilado com:
- ✅ GPS funcionando em background
- ✅ Notificações de chat e escala
- ✅ Rastreamento preciso 24/7
- ✅ Otimizações de performance mobile

**Teste e aproveite as melhorias!** 🚀📱
