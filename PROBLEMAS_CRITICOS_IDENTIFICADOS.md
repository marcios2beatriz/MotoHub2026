# 🚨 PROBLEMAS CRÍTICOS IDENTIFICADOS

## 📅 Data: 21 de Setembro de 2026

---

## ❌ **PROBLEMA 1: CORRIDAS DUPLICADAS (INTERMITENTE)**

### **Sintoma:**
- Corridas aparecem brevemente duplicadas
- Ao trocar de aba, às vezes volta ao normal
- Às vezes a duplicação persiste

### **Causa Raiz Identificada:**

**1. Realtime + Pull combinados podem causar race condition:**
```typescript
// db.ts linha ~1495
.on('postgres_changes', { event: 'INSERT' }, (payload) => {
  if (!memoryDeliveries.some(d => d.id === parsed.id)) {
    memoryDeliveries = [parsed, ...memoryDeliveries];
    // ↑ Adiciona no início
  }
})

// MAIS

// pullFromSupabase() linha ~1396
memoryDeliveries = allDelData.map(parseDeliveryRow);
// ↑ Sobrescreve tudo
```

**Cenário de duplicação:**
```
1. Usuário cria corrida
2. INSERT realtime adiciona no início do array
3. pullFromSupabase() é chamado logo depois
4. Pull carrega TUDO do banco incluindo a nova corrida
5. Array agora tem: [corrida_nova_realtime, ...outras, corrida_nova_pull]
6. DUPLICAÇÃO!
```

### **Solução:**

**Opção A: Remover throttle e usar APENAS realtime** ✅ RECOMENDADO
```typescript
// Desabilitar pullFromSupabase automático
// Confiar 100% nos listeners realtime
// Pull manual apenas no login inicial
```

**Opção B: Deduplicar sempre antes de renderizar**
```typescript
const uniqueDeliveries = Array.from(
  new Map(deliveries.map(d => [d.id, d])).values()
);
```

---

## ❌ **PROBLEMA 2: DIVERGÊNCIA NOS RELATÓRIOS DE PAGAMENTO**

### **Sintoma:**
- Alguns valores aparecem maior do que deveriam
- Outros valores aparecem menor

### **Possíveis Causas:**

**1. Cálculo inconsistente da taxa administrativa:**
```typescript
// Corrida de R$ 4,00 deve ser isenta
// MAS pode estar sendo descontada em algum lugar

// Verificar em TODOS os lugares:
- RiderDashboard cálculo todayNetEarnings
- AdminDashboard totais financeiros
- EstablishmentDashboard relatórios
- RiderFinancialMetricsCard (acabamos de modificar!)
```

**2. Adicional sendo ou não sendo contabilizado:**
```typescript
// Adicional NUNCA deve ter taxa
// MAS pode estar sendo descontada taxa sobre adicional
```

**3. Parse de números inconsistente:**
```typescript
// Alguns lugares usam:
Number(d.value || 0)
// Outros usam:
parseFloat(d.value)
// Outros usam:
d.value
```

### **Solução:**

**Criar funções centralizadas:**
```typescript
// utils/calculations.ts
export const getTotalValue = (d: Delivery): number => {
  return Number(d.value || 0);
};

export const getAdditionalValue = (d: Delivery): number => {
  return Number(d.additionalValue || 0);
};

export const getAdminFee = (d: Delivery): number => {
  const val = getTotalValue(d);
  // Isentas: R$ 4,00 ou same_address
  if (d.deliveryType === 'same_address' || val <= 4.00) {
    return 0;
  }
  return 1.00; // R$ 1,00
};

export const getRiderNet = (d: Delivery): number => {
  const total = getTotalValue(d);
  const additional = getAdditionalValue(d);
  const fee = getAdminFee(d);
  
  // Líquido = Corrida - Taxa + Adicional
  // Adicional SEMPRE é 100% do motoboy
  return Math.max(0, total - fee) + additional;
};
```

**Usar ESSAS funções em TODO lugar:**
- RiderDashboard
- AdminDashboard
- EstablishmentDashboard
- RiderFinancialMetricsCard
- Relatórios CSV

---

## ❌ **PROBLEMA 3: GPS BACKGROUND NÃO FUNCIONA**

### **Sintoma:**
- GPS para quando app é minimizado
- Rastreamento não continua em background

### **Causa Raiz:**

**HOJE IMPLEMENTAMOS o plugin nativo MAS:**
```typescript
// gpsTracker.ts linha ~210
try {
  const result = await GpsTracking.startTracking();
  // ✅ Código adicionado HOJE
} catch (nativeErr) {
  console.warn('Plugin não disponível');
  // ⚠️ Fallback para métodos limitados
}
```

**O plugin pode estar falhando silenciosamente por:**
1. ❌ Build não foi feito após mudanças
2. ❌ Plugin não foi registrado no MainActivity
3. ❌ APK não foi regerado
4. ❌ Permissões não foram concedidas

### **Solução:**

**PASSO 1: Verificar se está usando PWA ou APK**
```
PWA: GPS background é MUITO limitado
APK: GPS background deve funcionar com plugin nativo
```

**PASSO 2: Se for PWA - LIMITAÇÃO ESPERADA**
```
PWA não consegue GPS 100% em background
Navegadores bloqueiam por segurança/bateria
SOLUÇÃO: Usar APK nativo
```

**PASSO 3: Se for APK - GERAR NOVO BUILD**
```bash
# Mudanças de HOJE precisam ser compiladas!
pnpm run build
npx cap sync android
npx cap open android
# Build APK
```

**PASSO 4: Verificar logs**
```
Logcat > filtro: GpsTracking

Se ver:
✅ "GPS Tracking nativo iniciado" = Funcionando
⚠️ "Plugin não disponível" = Fallback (limitado)
❌ Erro = Problema de build/permissão
```

---

## 🔧 **PLANO DE CORREÇÃO**

### **Prioridade 1: GPS Background (CRÍTICO)**

```bash
# 1. Rebuild completo
pnpm run build
npx cap sync android
npx cap open android

# 2. Android Studio
Build > Clean Project
Build > Rebuild Project  
Build > Build APK(s)

# 3. Instalar novo APK
# 4. Conceder permissões:
#    - Localização "o tempo todo"
#    - Notificações
# 5. Desabilitar otimização de bateria

# 6. TESTAR:
#    - Iniciar rastreamento
#    - VERIFICAR: Notificação "GPS Ativo" aparece
#    - Minimizar app
#    - VERIFICAR: GPS continua atualizando
```

**Se AINDA não funcionar:**
- Ver `INTEGRACAO_GPS_NATIVO_COMPLETA.md` seção troubleshooting
- Verificar Logcat para erros
- Confirmar que MainActivity tem `registerPlugin(GpsTrackingPlugin.class)`

---

### **Prioridade 2: Corridas Duplicadas**

**Correção imediata (Opção B - deduplicação):**

```typescript
// Em TODOS os dashboards onde listar deliveries:

const uniqueDeliveries = useMemo(() => {
  const map = new Map();
  deliveries.forEach(d => map.set(d.id, d));
  return Array.from(map.values());
}, [deliveries]);

// Usar uniqueDeliveries ao invés de deliveries
```

**Aplicar em:**
- RiderDashboard.tsx
- AdminDashboard.tsx
- EstablishmentDashboard.tsx

---

### **Prioridade 3: Divergência de Valores**

**Criar arquivo de cálculos centralizados:**

```typescript
// src/utils/financialCalculations.ts

export const getTotalValue = (d: Delivery): number => 
  Number(d.value || 0);

export const getAdditionalValue = (d: Delivery): number => 
  Number(d.additionalValue || 0);

export const isExemptFromFee = (d: Delivery): boolean => {
  const val = getTotalValue(d);
  return d.deliveryType === 'same_address' || val <= 4.00;
};

export const getAdminFee = (d: Delivery): number => 
  isExemptFromFee(d) ? 0 : 1.00;

export const getGrossValue = (d: Delivery): number => 
  getTotalValue(d) + getAdditionalValue(d);

export const getRiderNet = (d: Delivery): number => {
  const total = getTotalValue(d);
  const additional = getAdditionalValue(d);
  const fee = getAdminFee(d);
  return Math.max(0, total - fee) + additional;
};
```

**Substituir TODAS as ocorrências de cálculo manual por essas funções**

---

## 📊 **RESUMO DOS PROBLEMAS**

| Problema | Gravidade | Causa | Solução |
|----------|-----------|-------|---------|
| Corridas duplicadas | 🟡 Média | Race condition realtime + pull | Deduplicação |
| Divergência valores | 🔴 Alta | Cálculos inconsistentes | Funções centralizadas |
| GPS background | 🔴 Crítica | APK não regerado | Rebuild + testar |

---

## ✅ **CHECKLIST DE CORREÇÃO**

### **Imediato (próximos 30 min):**
- [ ] Deduplicar deliveries nos dashboards
- [ ] Gerar novo APK com plugin GPS
- [ ] Instalar e testar GPS background

### **Logo após (1-2 horas):**
- [ ] Criar financialCalculations.ts
- [ ] Substituir cálculos manuais
- [ ] Testar relatórios de pagamento
- [ ] Validar todos os valores

### **Validação final:**
- [ ] GPS funciona em background (APK)
- [ ] Nenhuma corrida duplicada
- [ ] Valores corretos em todos relatórios
- [ ] Admin, Estabelecimento e Motoboy com dados consistentes

---

## 🚨 **AÇÕES URGENTES**

**1. GPS Background (AGORA):**
```bash
pnpm run build
npx cap sync android
npx cap open android
# Build APK e testar
```

**2. Corridas Duplicadas (AGORA):**
```typescript
// Adicionar deduplicação em todos dashboards
const unique = Array.from(new Map(deliveries.map(d => [d.id, d])).values());
```

**3. Valores (PRÓXIMO):**
```typescript
// Criar utils/financialCalculations.ts
// Centralizar TODOS os cálculos
```

---

**Status:** 🔴 **PROBLEMAS CRÍTICOS IDENTIFICADOS**

**Bloqueio:** ❌ **Nenhum** - Soluções são diretas

**Tempo estimado correção:** ⏱️ **2-3 horas total**

---

_Análise realizada: 21 de Setembro de 2026_
