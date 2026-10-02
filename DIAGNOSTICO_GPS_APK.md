# 🔍 DIAGNÓSTICO: GPS NÃO FUNCIONA EM BACKGROUND

## 📅 Data: 23 de Setembro de 2026

---

## 🚨 **PROBLEMA REPORTADO**

GPS do motoboy some do mapa após ~10 minutos com:
- App minimizado ❌
- Tela apagada ❌
- Usando outro app (Waze) ❌

**Isso indica:** Plugin nativo NÃO está sendo usado!

---

## 🔍 **DIAGNÓSTICO PASSO A PASSO**

### **TESTE 1: Verificar se Plugin Está Carregando**

**No celular com APK instalado:**

1. Conectar celular no PC via USB
2. Habilitar "Depuração USB" no celular
3. Abrir Android Studio
4. Ir em: **View > Tool Windows > Logcat**
5. Filtrar por: **"GpsTracking"**
6. Limpar logs (ícone 🚫)
7. **No celular:** Abrir MotoHub e clicar "Iniciar Rastreamento"

**LOGS ESPERADOS (Sucesso):**
```
I/GpsTrackingPlugin: startTracking() chamado
I/GpsTrackingService: onCreate() - Serviço iniciado
I/GpsTrackingService: onStartCommand() - Foreground iniciado
I/GpsTrackingService: Notificação criada: GPS Ativo
I/GpsTrackingService: LocationRequest configurado
I/GpsTrackingService: FusedLocationProvider iniciado
I/GpsTrackingService: processLocationUpdate() - distance: 12.5m
```

**LOGS DE FALHA (Plugin não encontrado):**
```
⚠️ Plugin GpsTracking não disponível, usando fallback
```

Se ver o log de **FALHA**, o plugin NÃO foi compilado corretamente!

---

## ❌ **CAUSA MAIS PROVÁVEL**

### **Problema: Gradle não compilou os arquivos Java**

**Por quê isso acontece:**
1. Arquivos `.java` foram adicionados MAS
2. Android Studio não sincronizou o Gradle corretamente
3. Build do APK não incluiu o código nativo
4. APK usa fallback web (que não funciona em background)

---

## ✅ **SOLUÇÃO: FORÇAR REBUILD COMPLETO**

### **PASSO 1: Limpar TUDO**

No Android Studio (com projeto android/ aberto):

```
1. Build > Clean Project (aguardar terminar)
2. File > Invalidate Caches / Restart (vai reiniciar)
3. Aguardar reabrir
```

### **PASSO 2: Verificar arquivos Java**

No Android Studio:

```
1. Painel esquerdo > Android
2. Expandir: app > java > com.motohub.delivery
3. VERIFICAR que existem:
   ✓ GpsTrackingPlugin.java
   ✓ GpsTrackingService.java
   ✓ MainActivity.java
```

**Se NÃO aparecerem:**
- Ir em: **File > Sync Project with Gradle Files**
- Aguardar sincronizar
- Verificar novamente

### **PASSO 3: Verificar MainActivity**

No Android Studio:

```
1. Abrir: MainActivity.java
2. VERIFICAR que tem essas linhas:

@Override
public void onStart() {
    super.onStart();
    
    // Registrar plugins customizados
    registerPlugin(GpsTrackingPlugin.class);
    registerPlugin(NotificationPlugin.class);
}
```

**Se NÃO tiver**, adicione manualmente!

### **PASSO 4: Rebuild Completo**

```
1. Build > Clean Project
2. Build > Rebuild Project (aguardar ~3 min)
3. Ver console para erros
```

**VERIFICAR Console:**
- ✅ "BUILD SUCCESSFUL"
- ❌ Se houver erros de compilação, me envie!

### **PASSO 5: Gerar Novo APK**

```
1. Build > Build Bundle(s) / APK(s) > Build APK(s)
2. Aguardar: "APK(s) generated successfully"
3. Copiar APK para celular
4. Instalar (atualizar)
```

---

## 🧪 **TESTE DEFINITIVO**

Após instalar novo APK:

### **1. Ver Logcat em tempo real:**
```
Android Studio > Logcat
Filtro: GpsTracking
```

### **2. No celular:**
```
Abrir MotoHub > Login motoboy > Iniciar Rastreamento
```

### **3. Verificar Logcat:**

**✅ SE VER:**
```
I/GpsTrackingService: onCreate()
I/GpsTrackingService: Foreground iniciado
```

**= SUCESSO! Plugin está funcionando!**

**❌ SE VER:**
```
⚠️ Plugin GpsTracking não disponível
```

**= FALHA! Plugin não foi compilado!**

---

## 🔧 **SE AINDA ASSIM NÃO FUNCIONAR**

### **Opção A: Recriar projeto Android**

```bash
# No terminal do projeto
rm -rf android
npx cap add android
npx cap sync android
```

Depois:
1. Copiar arquivos Java novamente
2. Editar MainActivity.java
3. Rebuild tudo

### **Opção B: Verificar Gradle**

Abrir: `android/app/build.gradle`

Verificar que tem:
```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-location:21.0.1'
}
```

Se NÃO tiver, adicionar e sync Gradle!

---

## 📊 **CHECKLIST DE DIAGNÓSTICO**

Execute e marque:

**Arquivos:**
- [ ] `GpsTrackingService.java` existe
- [ ] `GpsTrackingPlugin.java` existe
- [ ] `MainActivity.java` tem `registerPlugin()`
- [ ] `AndroidManifest.xml` tem `<service>`
- [ ] `build.gradle` tem `play-services-location`

**Build:**
- [ ] Clean Project executado
- [ ] Rebuild Project sem erros
- [ ] APK gerado com data de HOJE
- [ ] APK tem ~20-30 MB

**Teste:**
- [ ] Logcat mostra logs do GpsTrackingService
- [ ] Notificação "GPS Ativo" aparece
- [ ] GPS continua por mais de 10 min em background

**Se TUDO ✓ e ainda não funciona:**
- Há algum problema de permissões ou otimização de bateria

---

## 🆘 **INFORMAÇÕES PARA ME ENVIAR**

Se nada funcionar, me envie:

1. **Screenshot do Logcat** (filtro: GpsTracking)
2. **Console do Build** (Rebuild Project)
3. **Screenshot da notificação** (se aparecer)
4. **Versão do Android** do celular
5. **Marca/modelo** do celular

Com essas informações posso diagnosticar exatamente o que está acontecendo!

---

## 💡 **DICA IMPORTANTE**

O problema mais comum é:

**Gradle não compilou o código Java!**

**Solução:** 
```
Clean Project + Invalidate Caches + Rebuild Project
```

Isso força o Android Studio a recompilar TUDO do zero.

---

_Guia de diagnóstico: 23 de Setembro de 2026_
