# 🔧 Resolver Erro de Build do Android

## Problema
Build falha no Android Studio com erro relacionado ao Gradle/ZIP.

## Solução Rápida

### 1️⃣ Feche TUDO
- Feche o Android Studio completamente
- Feche qualquer terminal/PowerShell aberto

### 2️⃣ Limpe o Cache do Gradle

Abra um PowerShell NOVO e execute:

```powershell
cd C:\Users\ectli\dyad-apps\moto-hub2026-3-1\android
Remove-Item -Recurse -Force .gradle
Remove-Item -Recurse -Force app\build
Remove-Item -Recurse -Force build
```

### 3️⃣ Limpe o Cache Global do Gradle

```powershell
Remove-Item -Recurse -Force $env:USERPROFILE\.gradle\caches
```

### 4️⃣ Abra o Android Studio Novamente

- Abra o Android Studio
- Abra o projeto: `C:\Users\ectli\dyad-apps\moto-hub2026-3-1\android`
- Espere sincronizar (pode demorar alguns minutos)

### 5️⃣ Reconstrua o Projeto

No menu:
- `Build` → `Clean Project` (aguarde finalizar)
- `Build` → `Rebuild Project` (aguarde finalizar)

### 6️⃣ Rode no Dispositivo

- Clique no botão ▶️ Run
- Selecione seu dispositivo Android
- Aguarde instalação

---

## Se ainda assim não funcionar

### Opção A: Invalidate Caches

No Android Studio:
- `File` → `Invalidate Caches...`
- Marque todas as opções
- Clique em `Invalidate and Restart`

### Opção B: Reinstale o Gradle Wrapper

```powershell
cd C:\Users\ectli\dyad-apps\moto-hub2026-3-1\android
.\gradlew wrapper --gradle-version=8.7
```

### Opção C: Verifique espaço em disco

- Certifique-se que há pelo menos 5GB livres no disco C:
- O build do Android precisa de espaço temporário

---

## Depois que funcionar

✅ Gere o APK:
- `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
- Pegue em: `android\app\build\outputs\apk\debug\app-debug.apk`

✅ Instale no celular do motoboy

✅ Teste com app minimizado - o GPS deve continuar salvando!
