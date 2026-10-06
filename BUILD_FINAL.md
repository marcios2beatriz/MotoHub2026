# 🎯 SOLUÇÃO FINAL - Gerar APK Manual

O problema é corrupção de cache do Gradle que continua retornando. Vamos usar o método mais direto:

## MÉTODO 1: Android Studio com Build Bundle (RECOMENDADO)

1. **Feche TUDO** (Android Studio, PowerShell, tudo)

2. **Abra um PowerShell NOVO** como Administrador

3. **Execute**:
   ```powershell
   cd C:\Users\ectli\dyad-apps\moto-hub2026-3-1
   Remove-Item -Recurse -Force android\.gradle, android\app\build, android\build, $env:USERPROFILE\.gradle\caches
   ```

4. **Abra Android Studio**

5. **Menu**: `Build` → `Generate Signed Bundle / APK`

6. **Selecione**: `APK` → `Next`

7. **NÃO TEM KEYSTORE?**
   - Clique em `Create new...`
   - Key store path: `C:\Users\ectli\motohub-key.jks`
   - Password: `motohub2026` (anote isso!)
   - Alias: `motohub`
   - Password: `motohub2026`
   - Validity: 25
   - First/Last Name: MotoHub
   - Organization: Seu Nome
   - City: Sua Cidade
   - State: Seu Estado
   - Country: BR
   - Clique `OK`

8. **Build Variants**: `debug`

9. **Clique em `Finish`**

10. **Aguarde** 5-10 minutos

11. **APK em**: `android\app\build\outputs\apk\debug\app-debug.apk`

---

## MÉTODO 2: Via Linha de Comando (SEM Android Studio)

Se o Android Studio não funcionar, abra PowerShell como Admin:

```powershell
cd C:\Users\ectli\dyad-apps\moto-hub2026-3-1\android

# Limpar
Remove-Item -Recurse -Force .gradle, app\build, build

# Build com configurações especiais
$env:GRADLE_OPTS="-Xmx6g -XX:MaxMetaspaceSize=1g"
.\gradlew clean
.\gradlew assembleDebug --no-daemon --no-build-cache --no-configuration-cache
```

**Se der timeout**: deixe rodar até o fim, pode demorar 15-20 minutos

---

## MÉTODO 3: Usar APK antigo e atualizar só o código Java

Se NADA funcionar, podemos:

1. Pegar um APK antigo que você já tem
2. Extrair o `.apk`
3. Substituir só o `GpsTrackingService.class` compilado
4. Reempacotar

Mas isso é mais complexo. Tente os Métodos 1 e 2 primeiro!

---

## POR QUE ISSO ACONTECE?

O Gradle está criando arquivos ZIP corrompidos nos `intermediates` do build. Isso acontece quando:
- Pouco espaço em disco
- Antivírus bloqueando
- Processos Java travados
- Cache global do Gradle corrompido

---

## ÚLTIMA ALTERNATIVA: Build na nuvem

Se nada funcionar localmente, posso configurar um build via:
- GitHub Actions (grátis, ~10 min)
- Google Cloud Build
- Bitrise

Mas prefira tentar os métodos locais primeiro!
