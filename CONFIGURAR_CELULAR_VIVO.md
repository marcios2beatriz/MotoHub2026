# 📱 CONFIGURAÇÃO ESPECIAL - CELULAR VIVO

## ⚠️ **PROBLEMA IDENTIFICADO**

Celulares **Vivo** (e também Xiaomi, Oppo, Realme) têm gerenciamento de bateria **muito agressivo** que mata apps em background, mesmo com foreground service ativo.

**Sintomas:**
- ✅ Notificação aparece
- ❌ GPS para após alguns minutos
- ❌ Para quando tela apaga
- ❌ Para quando app é minimizado

---

## ✅ **SOLUÇÕES APLICADAS NO CÓDIGO**

### **1. WakeLock (PARTIAL_WAKE_LOCK)**
Mantém CPU ativa mesmo com tela apagada:
```java
wakeLock = powerManager.newWakeLock(
    PowerManager.PARTIAL_WAKE_LOCK,
    "MotoHub::GpsTrackingWakeLock"
);
```

### **2. START_REDELIVER_INTENT**
Se sistema matar serviço, reinicia automaticamente:
```java
return START_REDELIVER_INTENT; // Mais forte que START_STICKY
```

### **3. onTaskRemoved()**
Reinicia serviço se usuário fechar app da lista de recentes:
```java
@Override
public void onTaskRemoved(Intent rootIntent) {
    // Agenda restart do serviço em 1 segundo
    alarmManager.set(...);
}
```

### **4. stopWithTask="false"**
AndroidManifest configurado para não parar quando app fecha:
```xml
<service
    android:name=".GpsTrackingService"
    android:stopWithTask="false" />
```

---

## 🔧 **CONFIGURAÇÕES OBRIGATÓRIAS NO CELULAR VIVO**

### **PASSO 1: Desabilitar Otimização de Bateria**

```
1. Abrir Configurações
2. Bateria
3. Gerenciamento de bateria (ou Economizar bateria)
4. Aplicativos com alto consumo
5. Procurar: MotoHub Delivery
6. Selecionar: "Sem restrições" ou "Não otimizar"
```

**Alternativa:**
```
Configurações → Apps → MotoHub Delivery
→ Uso da bateria → "Não otimizar"
```

---

### **PASSO 2: Permitir Execução em Segundo Plano**

**Vivo específico:**
```
1. Configurações
2. Aplicativos
3. Gerenciar aplicativos
4. MotoHub Delivery
5. Consumo de bateria
6. Ativar: "Execução em segundo plano"
7. Ativar: "Inicialização automática"
```

---

### **PASSO 3: Adicionar na Lista de Apps Protegidos**

**Alguns celulares Vivo têm:**
```
Configurações → Aplicativos → Lista de proteção
→ Adicionar MotoHub Delivery ✅
```

**Ou:**
```
Configurações → Mais configurações → Permissões
→ Inicialização automática → MotoHub ✅
```

---

### **PASSO 4: Desabilitar "Otimizador de Memória"**

**Se disponível:**
```
Configurações → Memória e armazenamento
→ Limpeza automática → Desativar para MotoHub
```

---

### **PASSO 5: Bloquear App na Lista de Recentes**

Quando minimizar o app:
```
1. Abrir lista de apps recentes (botão de tarefas)
2. Procurar card do MotoHub
3. Deslizar para baixo (ou apertar ícone de cadeado)
4. Bloquear app (ícone de cadeado deve aparecer)
```

Isso impede que sistema feche o app automaticamente.

---

## 🧪 **TESTE APÓS CONFIGURAÇÕES**

### **Teste 1: Tela Apagada (2 minutos)**
```
1. Login como motoboy (GPS ativo, notificação visível)
2. Apagar tela do celular (botão power)
3. Aguardar 2 minutos
4. Acender tela
5. VERIFICAR: Notificação continua? ✅
6. VERIFICAR: No admin, motoboy ainda no mapa? ✅
```

---

### **Teste 2: App Minimizado (5 minutos)**
```
1. GPS ativo
2. Apertar botão Home (minimizar)
3. Aguardar 5 minutos (use celular normalmente)
4. VERIFICAR: Notificação continua visível? ✅
5. VERIFICAR: No admin, posição atualizou? ✅
```

---

### **Teste 3: Com Waze (10 minutos)**
```
1. GPS MotoHub ativo
2. Minimizar MotoHub
3. Abrir Waze e navegar
4. Dirigir/caminhar por 10 minutos
5. VERIFICAR: Notificação MotoHub continua? ✅
6. VERIFICAR: No admin, trajetória aparece? ✅
```

---

## 📊 **VERIFICAR LOGS (OPCIONAL)**

Se tiver cabo USB e Android Studio:

```
1. Conectar celular via USB
2. Android Studio → Logcat
3. Filtro: "GpsTrackingService"
4. Deixar app minimizado e observar logs
```

**Logs esperados a cada 5 segundos:**
```
D/GpsTrackingService: 📍 Location received: lat=-23.xxxxx, lng=-46.xxxxx
D/GpsTrackingService: ✅ Update: distance=12.5m, timeDiff=5s
D/GpsTrackingService: ✅ Location sent to JS and notification updated
```

**Se logs pararem:**
```
D/GpsTrackingService: ⚠️ onTaskRemoved() - App foi fechado
D/GpsTrackingService: ✅ Restart agendado para 1s
D/GpsTrackingService: onStartCommand() called - RESTART
```

**Se sistema matar:**
```
(nenhum log por alguns segundos)
D/GpsTrackingService: onCreate() called
D/GpsTrackingService: onStartCommand() called - RESTART AUTOMÁTICO
```

---

## ❓ **TROUBLESHOOTING**

### **Problema: GPS para após 5-10 minutos**

**Causa:** Sistema Vivo matou o serviço

**Soluções (tente nesta ordem):**

1. **Verificar WakeLock nos logs:**
   ```
   Procurar: "WakeLock held: true"
   Se false: Código não rodou, rebuild APK
   ```

2. **Desabilitar "Economia de bateria extrema":**
   ```
   Configurações → Bateria
   → Desativar modo extremo
   ```

3. **Resetar otimizações do app:**
   ```
   Configurações → Apps → MotoHub
   → Armazenamento → Limpar cache
   → Desinstalar e reinstalar APK
   → Refazer configurações de bateria
   ```

4. **Adicionar exceção de sistema:**
   ```
   Configurações → Aplicativos → Apps do sistema
   → Gerenciador de tarefas (ou Task Manager)
   → Adicionar MotoHub na whitelist
   ```

---

### **Problema: Notificação some ao bloquear tela**

**Causa:** Modo "Não perturbe" ativo

**Solução:**
```
Configurações → Notificações → Não perturbe
→ Adicionar MotoHub nas exceções
→ OU desativar "Não perturbe"
```

---

### **Problema: GPS funciona mas para ao fechar app da lista de recentes**

**Causa:** onTaskRemoved() não está rodando

**Solução:**
```
1. Verificar se "Inicialização automática" está ativada
2. Bloquear app na lista de recentes (ícone cadeado)
3. Não fechar app com "X", apenas minimizar com Home
```

---

## 🎯 **CHECKLIST FINAL - CELULAR VIVO**

Antes de considerar funcionando:

**Configurações do Celular:**
- [ ] Bateria: "Sem restrições" ✅
- [ ] Execução em segundo plano: Ativada ✅
- [ ] Inicialização automática: Ativada ✅
- [ ] App bloqueado na lista de recentes ✅
- [ ] Não perturbe: MotoHub nas exceções ✅

**Permissões do App:**
- [ ] Localização: "Permitir o tempo todo" ✅
- [ ] Notificações: "Permitir" ✅
- [ ] Execução em segundo plano: Permitida ✅

**Testes:**
- [ ] Funciona com tela apagada (2+ min) ✅
- [ ] Funciona minimizado (5+ min) ✅
- [ ] Funciona com Waze simultaneamente ✅
- [ ] Notificação permanece visível ✅
- [ ] Admin vê posição atualizada ✅

---

## 📞 **SE AINDA NÃO FUNCIONAR**

Depois de fazer TODAS as configurações acima:

**Me envie:**
1. Print da tela de "Consumo de bateria" do MotoHub
2. Print da tela de "Permissões" do MotoHub
3. Print dos logs do Logcat (se possível)
4. Quanto tempo o GPS fica ativo antes de parar?
5. Para quando faz o quê? (minimizar, apagar tela, abrir outro app?)

---

## 🆘 **SOLUÇÃO EXTREMA (ÚLTIMO RECURSO)**

Se NADA funcionar, celular Vivo está muito restritivo:

**Opção 1: Desabilitar otimização global**
```
Configurações → Bateria → Gerenciamento de bateria
→ Desativar completamente (não recomendado, gasta muita bateria)
```

**Opção 2: Modo desenvolvedor**
```
1. Ativar modo desenvolvedor
2. Opções do desenvolvedor
3. "Não manter atividades" → DESATIVADO
4. "Limite de processos em segundo plano" → Padrão
```

**Opção 3: Usar outro celular para teste**
- Samsung com Android 12+ funciona melhor
- Motorola com Android puro funciona melhor
- Google Pixel funciona perfeitamente

---

## 📚 **REFERÊNCIAS**

Fabricantes conhecidos por matar apps em background:
- **Vivo** ⚠️⚠️⚠️ (muito agressivo)
- Xiaomi ⚠️⚠️⚠️
- Oppo ⚠️⚠️
- Realme ⚠️⚠️
- Huawei ⚠️
- Samsung ⚠️ (menos agressivo)

Site sobre o problema: https://dontkillmyapp.com/vivo

---

**Data:** 27/09/2026  
**Versão:** 2.1 - Proteções extras para Vivo  
**Status:** Código atualizado com WakeLock e auto-restart  
