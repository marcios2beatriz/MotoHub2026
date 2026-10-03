# 📦 Como Gerar APK para Distribuição aos Motoboys

## Opção 1: Via Android Studio (RECOMENDADO)

### APK de Debug (para testes rápidos)

1. **Abra o Android Studio**
2. **Menu**: `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
3. **Aguarde** o build finalizar (~3-5 minutos)
4. **Notificação** aparecerá no canto inferior direito: "APK(s) generated successfully"
5. **Clique em**: `locate` na notificação
6. **Arquivo gerado**: `android/app/build/outputs/apk/debug/app-debug.apk`

### APK de Release (para produção - versão final)

1. **Abra o Android Studio**
2. **Menu**: `Build` → `Generate Signed Bundle / APK`
3. **Selecione**: `APK` → `Next`
4. **Keystore**:
   - Se já tiver: selecione o arquivo `.jks` e preencha senhas
   - Se não tiver: clique em `Create new...` e configure:
     - Key store path: `android/app/motohub-release-key.jks`
     - Password: (escolha uma senha forte)
     - Alias: `motohub`
     - Validity: 25 anos
     - Organization: Nome da sua empresa
5. **Build Variants**: selecione `release`
6. **Signature Versions**: marque `V1` e `V2`
7. **Finish** e aguarde
8. **Arquivo gerado**: `android/app/release/app-release.apk`

---

## Opção 2: Via Linha de Comando

### APK de Debug

```powershell
cd android
.\gradlew assembleDebug
```

**Arquivo gerado**: `android\app\build\outputs\apk\debug\app-debug.apk`

### APK de Release (requer keystore configurado)

```powershell
cd android
.\gradlew assembleRelease
```

**Arquivo gerado**: `android\app\build\outputs\apk\release\app-release.apk`

---

## 📤 Distribuir para os Motoboys

### Método 1: WhatsApp/Telegram
1. Envie o arquivo `.apk` diretamente
2. Instrua o motoboy a:
   - Baixar o arquivo
   - Habilitar "Instalar de fontes desconhecidas" (Configurações → Segurança)
   - Abrir o arquivo `.apk` baixado
   - Confirmar instalação

### Método 2: Google Drive/Dropbox
1. Faça upload do `.apk`
2. Gere link compartilhável
3. Envie o link para os motoboys

### Método 3: Link direto (servidor web)
1. Hospede o `.apk` em um servidor
2. Envie o link de download direto
3. Ex: `https://seu-site.com/downloads/motohub.apk`

---

## ⚠️ Diferenças: Debug vs Release

| Característica | Debug | Release |
|---------------|-------|---------|
| **Tamanho** | Maior (~50-80MB) | Menor (~20-40MB) |
| **Performance** | Mais lento | Otimizado |
| **Logs** | Detalhados | Mínimos |
| **Segurança** | Baixa (não assinado propriamente) | Alta (assinado) |
| **Uso** | Testes internos | Produção/Usuários finais |
| **Play Store** | ❌ Não aceita | ✅ Aceita (se assinado) |

---

## 🔐 Importante sobre Keystore (Release)

**NUNCA perca o arquivo `.jks` e as senhas!**

- Sem ele, você **não consegue atualizar o app** na Play Store
- Faça **backup em local seguro**
- Guarde as senhas em gerenciador de senhas

---

## 📱 Localização do APK após Build

**Debug**:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

**Release**:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 🚀 Versão Atual

Esta versão inclui:
- ✅ GPS em background (tela apagada, app minimizado)
- ✅ Salvamento direto no Supabase via Android nativo
- ✅ GPS Watchdog (reinicia automaticamente se GPS travar)
- ✅ Notificação permanente enquanto GPS ativo
- ✅ Funciona enquanto usa Waze/Google Maps

---

## 💡 Dica Rápida

Para **testar rapidamente** com os motoboys, use a **Opção 1 - APK de Debug**.

Quando tudo estiver funcionando perfeitamente, gere o **APK de Release** para distribuição final.
