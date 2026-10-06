@echo off
echo ============================================
echo    COMPILANDO APK - MOTO HUB 2026
echo ============================================
echo.

REM Configurar Java 17
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%

echo [1/3] Verificando Java...
java -version
if %errorlevel% neq 0 (
    echo ERRO: Java 17 nao encontrado!
    pause
    exit /b 1
)

echo.
echo [2/3] Limpando build anterior...
call gradlew.bat clean --no-daemon

echo.
echo [3/3] Compilando APK (pode demorar 5-10 min)...
echo.

REM Compilar com configurações específicas para evitar conflito de versões
call gradlew.bat assembleDebug --no-daemon -Dorg.gradle.java.home="%JAVA_HOME%" -Pandroid.injected.build.api=36

if %errorlevel% neq 0 (
    echo.
    echo ============================================
    echo    ERRO AO COMPILAR!
    echo ============================================
    echo.
    echo Verifique os erros acima.
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
    
    REM Abrir pasta do APK
    explorer.exe "%CD%\app\build\outputs\apk\debug"
    
    echo.
    echo A pasta do APK foi aberta automaticamente!
    echo.
) else (
    echo.
    echo ============================================
    echo    ERRO: APK NAO FOI GERADO!
    echo ============================================
    echo.
)

pause
