@echo off
chcp 65001 >nul
echo ============================================
echo 📱 GERANDO APK - MOTOHUB (COM DEBUG)
echo ============================================
echo.

echo Verificando gradlew...
if not exist gradlew.bat (
    echo ❌ ERRO: gradlew.bat não encontrado!
    pause
    exit /b 1
)
echo ✅ gradlew.bat encontrado
echo.

echo [1/2] Limpando builds anteriores...
if exist app\build (
    rmdir /s /q app\build
    echo ✅ Build anterior removido
) else (
    echo ⚠️ Nenhum build anterior encontrado
)
echo.

echo [2/2] Compilando APK...
echo IMPORTANTE: Isso vai demorar 3-5 minutos!
echo NÃO FECHE esta janela!
echo.
echo Iniciando compilação...
echo.

gradlew.bat assembleDebug --no-daemon --stacktrace --info > build-log.txt 2>&1

if errorlevel 1 (
    echo.
    echo ❌❌❌ ERRO AO COMPILAR APK! ❌❌❌
    echo.
    echo Veja os erros no arquivo: build-log.txt
    echo.
    type build-log.txt
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo ✅ APK COMPILADO COM SUCESSO!
echo ============================================
echo.

if exist app\build\outputs\apk\debug\app-debug.apk (
    echo 📁 APK está em:
    echo %cd%\app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo Abrindo pasta do APK...
    explorer app\build\outputs\apk\debug
) else (
    echo ❌ APK NÃO FOI ENCONTRADO!
    echo Algo deu errado. Veja build-log.txt
)

echo.
pause
