@echo off
echo.
echo ============================================
echo    GERANDO APK - MOTO HUB 2026
echo ============================================
echo.

REM Etapa 1: Build do projeto
echo [1/4] Build do projeto...
call pnpm run build
if %errorlevel% neq 0 (
    echo ERRO no build!
    pause
    exit /b 1
)

REM Etapa 2: Sync com Android
echo.
echo [2/4] Sincronizando com Android...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERRO no sync!
    pause
    exit /b 1
)

REM Etapa 3: Configurar memoria do Gradle (FIX DO ERRO!)
echo.
echo [3/4] Configurando Gradle...
cd android
if not exist .gradle mkdir .gradle

REM Criar arquivo gradle.properties com memoria reduzida
echo # Configuracao de memoria para evitar erros > gradle.properties
echo org.gradle.jvmargs=-Xmx512m -XX:MaxMetaspaceSize=256m >> gradle.properties
echo org.gradle.daemon=true >> gradle.properties
echo org.gradle.parallel=true >> gradle.properties

REM Etapa 4: Build do APK
echo.
echo [4/4] Gerando APK (pode demorar 3-5 min)...
echo.
call gradlew.bat clean assembleDebug

if %errorlevel% neq 0 (
    echo.
    echo ============================================
    echo    ERRO AO GERAR APK!
    echo ============================================
    echo.
    echo Possivel solucao:
    echo 1. Abra Android Studio
    echo 2. File ^> Invalidate Caches / Restart
    echo 3. Build ^> Build APK(s)
    echo.
    pause
    exit /b 1
)

REM Verificar se APK foi gerado
if exist "app\build\outputs\apk\debug\app-debug.apk" (
    echo.
    echo ============================================
    echo    APK GERADO COM SUCESSO!
    echo ============================================
    echo.
    echo Localizacao:
    echo %CD%\app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo Tamanho:
    for %%A in ("app\build\outputs\apk\debug\app-debug.apk") do echo %%~zA bytes
    echo.
    echo Proximos passos:
    echo 1. Copie o APK para o celular
    echo 2. Instale
    echo 3. Permita "Localizacao o tempo todo"
    echo 4. Permita "Notificacoes"
    echo 5. Teste o rastreamento!
    echo.
) else (
    echo.
    echo ============================================
    echo    APK NAO ENCONTRADO!
    echo ============================================
    echo.
    echo Use Android Studio para gerar:
    echo Build ^> Build APK(s)
    echo.
)

cd ..
pause
