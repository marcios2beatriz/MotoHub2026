# 🚨 PROBLEMAS FINANCEIROS ENCONTRADOS

## Resumo dos Problemas

1. **Cálculos inconsistentes** - Diferentes partes do código calculam valores de formas diferentes
2. **Corridas "somem"** - Filtros complexos podem esconder corridas
3. **Valores incorretos** - Não considera taxa administrativa e adicionais corretamente

---

## Problema 1: Cálculo de Earnings Inconsistente no RiderDashboard

### Localização
`src/pages/RiderDashboard.tsx` linhas 814-817

### Código Atual (INCORRETO)
```typescript
const historyTotalEarnings = historyDeliveries
  .filter(d => d.status === 'active')
  .reduce((sum, d) => sum + Number(d.value || 0), 0);
```

### Problema
- Soma apenas `d.value` (valor base da corrida)
- **NÃO desconta** a taxa administrativa de R$ 1,00
- **NÃO inclui** valor adicional (`d.additionalValue`)
- Resultado: **Valor MAIOR** que o motoboy realmente recebe

### Correção Necessária
```typescript
const historyTotalEarnings = historyDeliveries
  .filter(d => d.status === 'active')
  .reduce((sum, d) => sum + getRiderNetForDelivery(d), 0);
```

---

## Problema 2: Cálculo de Faturamento Bruto Incorreto

### Localização
`src/pages/RiderDashboard.tsx` linha 480

### Código Atual (INCORRETO)
```typescript
const todayGrossEarnings = todayApprovedDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
```

### Problema
- Soma apenas `d.value`
- **NÃO inclui** `d.additionalValue`
- Se motoboy fez corrida de R$ 8,00 + R$ 2,00 adicional, mostra apenas R$ 8,00

### Correção Necessária
```typescript
const todayGrossEarnings = todayApprovedDeliveries.reduce((sum, d) => 
  sum + Number(d.value || 0) + Number(d.additionalValue || 0), 0
);
```

**OU melhor ainda:**
```typescript
import { getGrossTotal } from '../utils/financialCalculations';

const todayGrossEarnings = todayApprovedDeliveries.reduce((sum, d) => 
  sum + getGrossTotal(d), 0
);
```

---

## Problema 3: Filtros Complexos Causando "Sumiço" de Corridas

### Localização
`src/pages/RiderDashboard.tsx` linhas 787-812

### Código Atual
```typescript
if (filterMode === 'smart_shift') {
  if (!smartDate) return true;
  
  const opDate = getDeliveryOperationalDate(d.date, d.time);
  const isDateMatch = isSameDayString(opDate, smartDate) || isSameDayString(d.date, smartDate);
  
  if (!isDateMatch) return false;
  
  const [h] = (d.time || '12:00').split(':').map(Number);
  
  if (smartPeriod === 'night_shift') {
    return h >= 18 || h < 3; // ⚠️ Turno noturno cruza meia-noite
  } else if (smartPeriod === 'morning_shift') {
    return h >= 6 && h < 12;
  } else if (smartPeriod === 'afternoon_shift') {
    return h >= 12 && h < 18;
  }
  return true;
}
```

### Problemas
1. **Turno noturno atravessa meia-noite** - Corridas entre 00h-03h são do dia anterior operacionalmente
2. **getDeliveryOperationalDate pode retornar data diferente** - Causa confusão
3. **Fallback `'12:00'` quando `d.time` é vazio** - Pode esconder corridas sem horário

### Impacto
- Motoboy vê 10 corridas num dia, depois vê 8, depois vê 12
- Corridas "aparecem e desaparecem" conforme troca o filtro
- **Valores oscilam** porque corridas são escondidas/mostradas

---

## Problema 4: Múltiplas Fontes de Verdade para Status

### Localizações
- `src/pages/AdminDashboard.tsx` - Múltiplos `.filter(d => d.status === 'active')`
- `src/pages/RiderDashboard.tsx` - Múltiplos `.filter(d => d.status === 'active')`
- `src/pages/EstablishmentDashboard.tsx` - Múltiplos `.filter(d => d.status === 'active')`

### Problema
Status checado inline em dezenas de lugares:
```typescript
.filter(d => d.status === 'active')
.filter(d => d.status === 'pending')
.filter(d => d.status !== 'cancelled')
.filter(d => d.status === 'active' && d.paid)
```

### Impacto
- Se status mudar (ex: adicionar 'rejected'), precisa atualizar em 50+ lugares
- Inconsistências: um lugar filtra por 'active', outro por 'active' && !cancelled
- **Risco de bugs**: esquecer de atualizar um filtro causa valores errados

---

## Problema 5: Sincronização do Supabase

### Localização
`src/utils/db.ts` linha 1286+

### Código Atual
```typescript
async pullFromSupabase() {
  // EMERGÊNCIA: Removendo throttle temporariamente para forçar recarga completa dos dados
  // const now = Date.now();
  // if (now - pullThrottleTs < PULL_THROTTLE_MS) {
  //   return;
  // }
  // pullThrottleTs = now;
  
  console.log('🔄 EMERGÊNCIA: Forçando recarga COMPLETA dos dados do Supabase...');
```

### Problema
- Throttle **desativado** em modo emergência
- Significa que o app faz **requisições excessivas** ao Supabase
- Pode causar rate limiting
- **Corridas podem não aparecer** se sincronização falha parcialmente

### Possível Causa do "Sumiço"
Se `pullFromSupabase()` falha ou é interrompida:
- Dados ficam desatualizados em memória
- Corridas novas não aparecem
- Corridas antigas podem "sumir" se foram deletadas no DB mas ainda estão em memória

---

## Solução Proposta

### 1. Centralizar TODOS os Cálculos Financeiros

**Usar APENAS** funções de `src/utils/financialCalculations.ts`:
- ✅ `getRiderNet(d)` - Quanto o motoboy recebe
- ✅ `getGrossTotal(d)` - Quanto a corrida vale (com adicional)
- ✅ `getAdminFee(d)` - Taxa administrativa
- ✅ `getTotalRiderNet(deliveries)` - Total líquido de múltiplas corridas

**NUNCA fazer:**
```typescript
// ❌ ERRADO
sum + Number(d.value || 0)

// ✅ CORRETO
sum + getRiderNet(d)
```

### 2. Criar Funções Helper para Filtros

```typescript
// src/utils/deliveryFilters.ts
export const getActiveDeliveries = (deliveries: Delivery[]) => 
  deliveries.filter(d => d.status === 'active');

export const getPendingDeliveries = (deliveries: Delivery[]) => 
  deliveries.filter(d => d.status === 'pending');

export const getDeliveriesByDateRange = (deliveries: Delivery[], start: string, end: string) =>
  deliveries.filter(d => d.date >= start && d.date <= end);
```

### 3. Adicionar Logs de Debug

```typescript
useEffect(() => {
  console.log('📊 Dashboard: Total deliveries in memory:', deliveries.length);
  console.log('📊 Active deliveries:', deliveries.filter(d => d.status === 'active').length);
  console.log('📊 Filtered deliveries shown:', historyDeliveries.length);
}, [deliveries, historyDeliveries]);
```

### 4. Reativar Throttle com Lógica Correta

```typescript
async pullFromSupabase() {
  const now = Date.now();
  if (now - pullThrottleTs < PULL_THROTTLE_MS) {
    console.log('⏱️ Throttled: Última sync há', (now - pullThrottleTs) / 1000, 's');
    return;
  }
  pullThrottleTs = now;
  
  try {
    // ... pull data
    console.log('✅ Sync concluída com sucesso');
  } catch (error) {
    console.error('❌ Erro na sync:', error);
    // NÃO atualizar pullThrottleTs se falhou, permitir retry imediato
    pullThrottleTs = 0;
  }
}
```

---

## Prioridade de Correção

### 🔴 CRÍTICO (Fazer Agora)
1. Corrigir `historyTotalEarnings` no RiderDashboard (linha 814)
2. Corrigir `todayGrossEarnings` no RiderDashboard (linha 480)
3. Adicionar logs de debug para rastrear "sumiço" de corridas

### 🟡 IMPORTANTE (Próxima Sprint)
4. Criar `deliveryFilters.ts` e centralizar filtros
5. Reativar throttle com error handling
6. Documentar lógica de turnos noturnos

### 🟢 MELHORIAS (Backlog)
7. Adicionar testes automatizados para cálculos financeiros
8. Criar painel de debug para admins verem estado da memória
9. Implementar cache inteligente no Supabase

---

## Como Testar as Correções

1. **Teste de Cálculo**
   - Criar corrida de R$ 8,00 com R$ 2,00 adicional
   - Verificar que mostra:
     - Bruto: R$ 10,00
     - Taxa: R$ 1,00
     - Líquido: R$ 9,00 (não R$ 10,00!)

2. **Teste de Filtro**
   - Criar 5 corridas em horários diferentes
   - Trocar entre filtros (hoje, ontem, manhã, tarde, noite)
   - Verificar que quantidade de corridas é **consistente**
   - Verificar que valores **não oscilam**

3. **Teste de Sincronização**
   - Criar corrida no admin
   - Ver se aparece no rider em até 30s
   - Aprovar corrida no admin
   - Ver se muda status no rider em até 30s

---

**Criado em:** 2026-10-06
**Por:** Kiro AI Assistant
**Status:** Aguardando implementação
