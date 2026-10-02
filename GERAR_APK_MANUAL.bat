@echo off
echo ============================================
echo GERANDO APK - MOTOHUB DELIVERY
echo ============================================
echo.

echo [1/4] Limpando build anterior...
if exist android\app\build rmdir /s /q android\app\build
echo OK!
echo.

echo [2/4] Build do projeto (pode demorar 2-3 min)...
call pnpm run build
if errorlevel 1 (
    echo ERRO no build! Verifique os erros acima.
    pause
    exit /b 1
)
echo OK!
echo.

echo [3/4] Sync com Capacitor...
call npx cap sync android
if errorlevel 1 (
    echo ERRO no sync! Verifique os erros acima.
    pause
    exit /b 1
)
echo OK!
echo.

echo [4/4] Abrindo Android Studio...
call npx cap open android
echo.

echo ============================================
echo PROXIMOS PASSOS NO ANDROID STUDIO:
echo ============================================
echo 1. Aguardar Gradle Sync terminar
echo 2. Build > Clean Project
echo 3. Build > Rebuild Project
echo 4. Build > Build Bundle(s) / APK(s) > Build APK(s)
echo 5. APK estara em: android\app\build\outputs\apk\debug\app-debug.apk
echo ============================================
pause
