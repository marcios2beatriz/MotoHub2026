@echo off
chcp 65001 >nul
echo ============================================
echo 📱 GERANDO APK - MOTOHUB (OTIMIZADO)
echo ============================================
echo.

echo [1/3] Limpando cache do Gradle...
if exist .gradle rmdir /s /q .gradle
if exist app\build rmdir /s /q app\build
echo ✅ Cache limpo!
echo.

echo [2/3] Compilando APK (pode demorar 3-5 min)...
echo Aguarde... não feche esta janela!
echo.

gradlew.bat assembleDebug --no-daemon --max-workers=1

if errorlevel 1 (
    echo.
    echo ❌ ERRO ao compilar APK!
    echo Veja os erros acima.
    pause
    exit /b 1
)

echo.
echo ✅ APK GERADO COM SUCESSO!
echo.
echo 📁 APK está em:
echo app\build\outputs\apk\debug\app-debug.apk
echo.
echo Copie este arquivo para o celular e instale!
echo.
pause
