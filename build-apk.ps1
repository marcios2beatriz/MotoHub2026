Write-Host "Iniciando build do APK..." -ForegroundColor Green
Write-Host ""

Write-Host "Limpando caches e builds anteriores..." -ForegroundColor Yellow
Set-Location "android"

if (Test-Path "app\build") {
    Remove-Item -Recurse -Force "app\build" -ErrorAction SilentlyContinue
    Write-Host "  app\build deletado"
}

if (Test-Path "build") {
    Remove-Item -Recurse -Force "build" -ErrorAction SilentlyContinue
    Write-Host "  build deletado"
}

if (Test-Path ".gradle") {
    Remove-Item -Recurse -Force ".gradle" -ErrorAction SilentlyContinue
    Write-Host "  .gradle deletado"
}

Write-Host ""
Write-Host "Finalizando processos Gradle/Java..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*java*" -or $_.ProcessName -like "*gradle*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Processos finalizados"
Write-Host ""

Write-Host "Iniciando build do APK (pode demorar 5-10 minutos)..." -ForegroundColor Green
Write-Host "   Aguarde... Nao feche esta janela!" -ForegroundColor Cyan
Write-Host ""

$env:GRADLE_OPTS = "-Xmx4096m -XX:MaxMetaspaceSize=512m"

.\gradlew assembleDebug --no-daemon --stacktrace 2>&1 | Tee-Object -FilePath "..\build-log.txt"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "BUILD CONCLUIDO COM SUCESSO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK gerado em:" -ForegroundColor Cyan
    Write-Host "   app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
    Write-Host ""
    
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $apkSize = (Get-Item $apkPath).Length / 1MB
        Write-Host "   Tamanho: $([math]::Round($apkSize, 2)) MB" -ForegroundColor White
        Write-Host ""
        Write-Host "Pronto para instalar no celular!" -ForegroundColor Green
        
        explorer.exe "app\build\outputs\apk\debug"
    }
} else {
    Write-Host ""
    Write-Host "BUILD FALHOU!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Log completo salvo em: build-log.txt" -ForegroundColor Yellow
}

Set-Location ..
