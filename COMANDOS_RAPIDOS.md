# ⚡ COMANDOS RÁPIDOS

## 🚀 Gerar APK Agora

```bash
# 1. Build (2 min)
pnpm run build

# 2. Sync (30 seg)
npx cap sync android

# 3. Abrir Android Studio (1 min)
npx cap open android
```

**No Android Studio:**
```
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

**APK estará em:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🧪 Testar APK

1. Copiar APK para celular
2. Instalar
3. Permitir "Localização o tempo todo"
4. Permitir "Notificações"
5. Login como motoboy
6. Clicar "Iniciar Rastreamento"
7. **Verificar:** Notificação "GPS Ativo" na barra ✅
8. Minimizar e abrir Waze
9. Navegar 5 minutos
10. **Verificar:** Posição continua atualizando ✅

---

## 📊 Ver Logs

**Android Studio:**
```
View > Tool Windows > Logcat
Filtro: GpsTracking
```

**Logs esperados:**
```
✅ GPS Tracking nativo iniciado
📍 Location update: lat=-23.xxxx
📍 Location update: lat=-23.xxxy
```

---

## 🔧 Se algo falhar

**Rebuild completo:**
```bash
# Android Studio
Build > Clean Project
Build > Rebuild Project
Build > Build APK(s)
```

**Permissões no celular:**
```
Configurações > Apps > MotoHub
  > Localização: "Permitir o tempo todo"
  > Notificações: "Permitir"
  > Bateria: "Não otimizar"
```

---

## 📁 Documentação

- `RESUMO_EXECUTIVO_21SET2026.md` - Status completo
- `TESTE_RAPIDO_GPS_BACKGROUND.md` - Teste em 10 min
- `GUIA_VISUAL_RAPIDO.md` - O que esperar
- `INTEGRACAO_GPS_NATIVO_COMPLETA.md` - Guia técnico

---

## ✅ Checklist Rápido

- [ ] Build sem erros
- [ ] APK gerado
- [ ] Instalado no celular
- [ ] Permissões concedidas
- [ ] GPS ativo (notificação visível)
- [ ] Funciona com Waze
- [ ] Notificações chegam
- [ ] Tudo aprovado!

---

**Status:** 🟢 Pronto para teste
**Tempo:** ⏱️ 30 min total
