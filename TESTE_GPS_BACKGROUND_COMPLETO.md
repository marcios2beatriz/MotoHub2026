# 🧪 TESTE COMPLETO - GPS BACKGROUND

## ✅ **CHECKLIST DE VERIFICAÇÃO:**

### **1️⃣ NO CELULAR DO MOTOBOY:**

#### **A. Instalação e Permissões:**
- [ ] APK instalado (versão nova de hoje)
- [ ] App aberto
- [ ] Login feito como motoboy
- [ ] Permissão de localização: **"Permitir o tempo todo"** ✅ CRÍTICO!
- [ ] Permissão de notificações: **"Permitir"**
- [ ] Bateria não otimizada (se disponível)

#### **B. Iniciar Rastreamento:**
1. [ ] Clicar botão "Iniciar Rastreamento"
2. [ ] **VERIFICAR:** Apareceu notificação **"GPS Ativo"** ou similar na barra? 
   - ✅ Se SIM = GPS nativo está ativo!
   - ❌ Se NÃO = GPS nativo NÃO está funcionando!

#### **C. Teste com App Minimizado:**
1. [ ] Com GPS ativo, pressionar botão **Home** (minimizar)
2. [ ] Abrir outro app (Waze, Chrome, WhatsApp...)
3. [ ] **VERIFICAR:** Notificação "GPS Ativo" continua na barra?
   - ✅ Se SIM = Serviço em foreground ativo
   - ❌ Se NÃO = Serviço foi morto pelo sistema

#### **D. Teste com Tela Apagada:**
1. [ ] Com GPS ativo, apertar botão **Power** (apagar tela)
2. [ ] Aguardar 2-3 minutos
3. [ ] Ligar tela novamente
4. [ ] **VERIFICAR:** Notificação continua?
   - ✅ Se SIM = GPS sobreviveu
   - ❌ Se NÃO = GPS foi morto

#### **E. Teste de Movimento:**
1. [ ] Com GPS ativo e tela apagada
2. [ ] **Caminhar** com o celular por 5-10 minutos
3. [ ] OU dirigir um pouco
4. [ ] Verificar no admin se posição atualizou

---

### **2️⃣ NO ADMIN/ESTABELECIMENTO:**

#### **A. Abrir Mapa de Rastreamento:**
- [ ] Login como admin ou estabelecimento
- [ ] Abrir página de rastreamento
- [ ] **VERIFICAR:** Motoboy aparece no mapa?

#### **B. Verificar Atualização em Tempo Real:**
- [ ] Com motoboy se movendo
- [ ] Mapa deve atualizar automaticamente (Firebase Realtime)
- [ ] **NÃO PRECISA** atualizar página manualmente
- [ ] **INTERVALO:** A cada 10-15 segundos deve atualizar

#### **C. Verificar Console do Navegador:**
1. Pressionar **F12** no navegador
2. Ir em aba **Console**
3. Procurar mensagens como:
   ```
   📍 Localização atualizada: motoboy123
   🗺️ Atualizando posição no mapa
   ```

---

## 🔍 **SINAIS DE QUE GPS BACKGROUND ESTÁ FUNCIONANDO:**

### **✅ FUNCIONANDO CORRETAMENTE:**
1. ✅ Notificação "GPS Ativo" persistente na barra
2. ✅ Notificação continua com app minimizado
3. ✅ Notificação continua com tela apagada
4. ✅ Posição atualiza no mapa do admin
5. ✅ Posição atualiza mesmo com Waze aberto
6. ✅ Celular vibra/soa notificações normalmente

### **❌ NÃO ESTÁ FUNCIONANDO:**
1. ❌ Nenhuma notificação aparece
2. ❌ Notificação desaparece ao minimizar
3. ❌ Posição para de atualizar no admin
4. ❌ Motoboy "desaparece" do mapa após alguns minutos
5. ❌ Precisa reabrir app para voltar a rastrear

---

## 🐛 **DIAGNÓSTICO DE PROBLEMAS:**

### **Problema 1: Notificação NÃO aparece**
**Causa:** Código nativo não está sendo chamado ou permissões faltando

**Solução:**
1. Verificar permissão "Localização o tempo todo"
2. Verificar código TypeScript está chamando GPS nativo
3. Verificar logs do Android (Logcat)

---

### **Problema 2: Notificação aparece mas SOME ao minimizar**
**Causa:** Serviço foreground não está configurado corretamente

**Solução:**
1. Verificar AndroidManifest.xml tem permissão FOREGROUND_SERVICE
2. Verificar código nativo está chamando startForeground()
3. Verificar canal de notificação está criado

---

### **Problema 3: GPS funciona mas não atualiza no admin**
**Causa:** Problema no Firebase ou código TypeScript

**Solução:**
1. Verificar Firebase Realtime Database regras
2. Verificar código está fazendo update() no Firebase
3. Verificar conexão internet do celular

---

### **Problema 4: Posição para depois de X minutos**
**Causa:** Sistema Android matando serviço (Doze mode, battery optimization)

**Solução:**
1. Desabilitar otimização de bateria para o app
2. Verificar se canal de notificação tem prioridade alta
3. Adicionar wakelock se necessário

---

## 📊 **TABELA DE TESTES:**

| Teste | Esperado | Resultado | Status |
|-------|----------|-----------|--------|
| Notificação aparece | SIM | ? | ⏳ |
| Continua minimizado | SIM | ? | ⏳ |
| Continua tela apagada | SIM | ? | ⏳ |
| Atualiza no admin | SIM | ? | ⏳ |
| Funciona com Waze | SIM | ? | ⏳ |
| Dura mais de 10 min | SIM | ? | ⏳ |

---

## 🔧 **COMANDOS PARA DEBUG (se necessário):**

### **Ver logs Android em tempo real:**
```bash
# No Android Studio: View > Tool Windows > Logcat
# Filtrar por: "GpsTracking" ou "Capacitor"
```

### **Ver Firebase em tempo real:**
```
# Abrir Firebase Console
# Realtime Database > Data
# Procurar: geolocations > {motoboyId}
# Deve atualizar em tempo real
```

---

## 📱 **TESTE MÍNIMO (5 MINUTOS):**

1. ✅ Instalar APK
2. ✅ Permitir "localização o tempo todo"
3. ✅ Iniciar rastreamento
4. ✅ **VERIFICAR:** Notificação apareceu?
5. ✅ Minimizar app
6. ✅ Abrir Waze e navegar
7. ✅ No admin: ver se posição atualiza
8. ✅ Aguardar 5 minutos
9. ✅ **VERIFICAR:** Ainda rastreando?

---

## 🎯 **RESULTADO ESPERADO:**

Depois de 5 minutos de teste com Waze aberto e app minimizado:
- ✅ Notificação "GPS Ativo" ainda visível
- ✅ Posição no mapa do admin atualizou várias vezes
- ✅ Motoboy não "sumiu" do mapa

---

**ME AVISE OS RESULTADOS DESSES TESTES!** 🔍

Principalmente:
1. Apareceu notificação "GPS Ativo"?
2. Continua com app minimizado?
3. Atualiza no mapa do admin?
