# 🐛 BUG: SOBRA 1 CORRIDA APÓS DAR BAIXA

## 📅 Data: 21 de Setembro de 2026

---

## 🚨 **PROBLEMA IDENTIFICADO**

### **Sintoma:**
Ao dar baixa em corridas de um motoboy, **sobra 1 corrida não paga**.

### **Causa Raiz:**

O filtro `financeFilteredDeliveries` filtra corridas por:
1. Status === 'active' ✅
2. Data dentro do período selecionado ✅
3. Pago/Não pago (financePaidFilter) ✅

**MAS** quando clica "Dar Baixa", marca como pagas apenas as corridas **que aparecem no card** (filtradas).

Se existe uma corrida fora do período selecionado, ela **NÃO** é marcada como paga!

---

## 📊 **CENÁRIO DO BUG**

### **Setup:**
- Período selecionado: "Esta semana"
- Motoboy tem 5 corridas ativas não pagas:
  - 4 corridas desta semana
  - 1 corrida da semana passada

### **O que acontece:**

**1. Ao visualizar:**
```
financeFilteredDeliveries = [4 corridas] (só desta semana)
Card mostra: 4 corridas, R$ 28,00
```

**2. Ao clicar "Dar Baixa":**
```typescript
// Código atual
onSettle={() => handleSettleRiderDeliveries(
  rider.id, 
  riderDeliveries.map(d => d.id) // ← Só as 4 filtradas!
)}
```

**3. Resultado:**
- 4 corridas marcadas como `paid: true` ✅
- **1 corrida da semana passada continua `paid: false`** ❌

**4. Na próxima visualização:**
- Se mudar período para "Todas" ou "Mês passado"
- Aparece 1 corrida não paga sobrando!

---

## ✅ **SOLUÇÕES POSSÍVEIS**

### **Opção A: Marcar TODAS as corridas não pagas do motoboy** ⭐ RECOMENDADO

**Vantagem:**
- Fecha completamente o pagamento do motoboy
- Não sobra nenhuma corrida

**Desvantagem:**
- Pode marcar corridas que o usuário não viu

**Implementação:**
```typescript
// AdminDashboard.tsx linha ~3426
onSettle={() => {
  // Buscar TODAS as corridas não pagas do motoboy (independente do filtro)
  const allRiderUnpaidDeliveries = deliveries.filter(d => 
    d.riderId === rider.id && 
    d.status === 'active' && 
    !d.paid
  );
  
  handleSettleRiderDeliveries(
    rider.id, 
    allRiderUnpaidDeliveries.map(d => d.id)
  );
}}
```

---

### **Opção B: Avisar que existem corridas fora do período**

**Vantagem:**
- Transparente, usuário sabe o que está acontecendo

**Desvantagem:**
- Mais complexo, requer UI adicional

**Implementação:**
```typescript
// Verificar se há corridas fora do filtro
const allRiderUnpaidDeliveries = deliveries.filter(d => 
  d.riderId === rider.id && 
  d.status === 'active' && 
  !d.paid
);

const hiddenCount = allRiderUnpaidDeliveries.length - riderDeliveries.length;

// Mostrar aviso
{hiddenCount > 0 && (
  <div className="text-xs text-amber-600">
    ⚠️ {hiddenCount} corrida(s) fora do período
  </div>
)}
```

---

### **Opção C: Dar baixa apenas no que está visível (atual)** ❌ TEM O BUG

**Como está agora:**
```typescript
onSettle={() => handleSettleRiderDeliveries(
  rider.id, 
  riderDeliveries.map(d => d.id) // ← Só as filtradas
)}
```

**Problema:** Deixa corridas não pagas fora do filtro

---

## 🔧 **CORREÇÃO RECOMENDADA (Opção A)**

### **Arquivo: `src/pages/AdminDashboard.tsx`**

**Linha ~3426:**

```typescript
// ❌ ANTES (Bugado)
<RiderFinancialMetricsCard
  riderName={rider.name + (!rider.active ? ' (Inativo)' : '')}
  riderPhone={rider.phone}
  deliveries={riderDeliveries}
  isPaid={allPaid}
  showSettleButton={true}
  onSettle={() => handleSettleRiderDeliveries(
    rider.id, 
    riderDeliveries.map(d => d.id) // ← BUG: Só as filtradas
  )}
  onUnsettle={() => handleUnsettleRiderDeliveries(
    rider.id, 
    riderDeliveries.map(d => d.id)
  )}
  periodLabel={financeBounds.label}
/>
```

```typescript
// ✅ DEPOIS (Corrigido)
<RiderFinancialMetricsCard
  riderName={rider.name + (!rider.active ? ' (Inativo)' : '')}
  riderPhone={rider.phone}
  deliveries={riderDeliveries}
  isPaid={allPaid}
  showSettleButton={true}
  onSettle={() => {
    // Buscar TODAS as corridas não pagas do motoboy
    const allUnpaid = deliveries.filter(d => 
      d.riderId === rider.id && 
      d.status === 'active' && 
      !d.paid
    );
    
    // Confirmar se há corridas ocultas
    const hiddenCount = allUnpaid.length - riderDeliveries.length;
    
    if (hiddenCount > 0) {
      const confirmMsg = `Este motoboy tem ${riderDeliveries.length} corrida(s) no período selecionado e ${hiddenCount} corrida(s) fora do período.\n\nDeseja dar baixa em TODAS as ${allUnpaid.length} corridas não pagas?`;
      
      if (confirm(confirmMsg)) {
        handleSettleRiderDeliveries(rider.id, allUnpaid.map(d => d.id));
      }
    } else {
      // Sem corridas ocultas, baixa normalmente
      handleSettleRiderDeliveries(rider.id, riderDeliveries.map(d => d.id));
    }
  }}
  onUnsettle={() => {
    // Buscar TODAS as corridas pagas do motoboy
    const allPaid = deliveries.filter(d => 
      d.riderId === rider.id && 
      d.status === 'active' && 
      d.paid
    );
    handleUnsettleRiderDeliveries(rider.id, allPaid.map(d => d.id));
  }}
  periodLabel={financeBounds.label}
/>
```

---

## 🎯 **MESMO PROBLEMA EM EstablishmentDashboard**

O bug também existe em `EstablishmentDashboard.tsx`!

**Linha ~1803:**
```typescript
onSettle={() => handleSettleRiderDeliveries(
  rider.id, 
  riderDeliveries.map(d => d.id) // ← Mesmo bug
)}
```

**Correção:**
```typescript
onSettle={() => {
  // Buscar TODAS as corridas não pagas do motoboy neste estabelecimento
  const allUnpaid = deliveries.filter(d => 
    d.riderId === rider.id && 
    d.establishmentId === currentEst?.id &&
    d.status === 'active' && 
    !d.paid
  );
  
  const hiddenCount = allUnpaid.length - riderDeliveries.length;
  
  if (hiddenCount > 0 && !confirm(`Este motoboy tem ${hiddenCount} corrida(s) fora do período. Dar baixa em TODAS as ${allUnpaid.length} corridas?`)) {
    return;
  }
  
  handleSettleRiderDeliveries(rider.id, allUnpaid.map(d => d.id));
}}
```

---

## 🧪 **COMO REPRODUZIR O BUG**

1. Criar 5 corridas para um motoboy:
   - 4 corridas nesta semana
   - 1 corrida semana passada

2. Admin > Financeiro
3. Filtrar período: "Esta semana"
4. Ver motoboy: mostra 4 corridas
5. Clicar "Dar Baixa (Pagar)"
6. ✅ Confirmar

7. Mudar filtro para "Todas"
8. ❌ **Ver motoboy: aparece 1 corrida não paga** (a da semana passada)

---

## ✅ **TESTE DA CORREÇÃO**

Após aplicar a correção:

1. Criar 5 corridas (4 desta semana, 1 semana passada)
2. Admin > Financeiro > "Esta semana"
3. Clicar "Dar Baixa"
4. **Ver mensagem:**
   ```
   Este motoboy tem 4 corrida(s) no período selecionado 
   e 1 corrida(s) fora do período.
   
   Deseja dar baixa em TODAS as 5 corridas não pagas?
   ```
5. ✅ Confirmar
6. Mudar filtro para "Todas"
7. ✅ **Ver motoboy: 0 corridas não pagas** (todas foram pagas!)

---

## 📊 **RESUMO**

| Situação | Comportamento Atual | Comportamento Correto |
|----------|---------------------|----------------------|
| Todas corridas no período | ✅ Marca todas | ✅ Marca todas |
| Corridas fora do período | ❌ Deixa não pagas | ✅ Pergunta e marca todas |
| Usuário quer marcar só visíveis | ❌ Não tem opção | ✅ Pode cancelar |

---

## 🎯 **DECISÃO DE PRODUTO**

### **Comportamento recomendado:**

**Dar baixa = Pagar TODO o motoboy (não apenas período)**

**Motivo:**
- Pagamento de motoboy geralmente é TOTAL
- Não faz sentido pagar "só desta semana"
- Evita corridas esquecidas

**Implementação:**
- Sempre marcar TODAS as corridas não pagas
- Avisar se há corridas fora do período
- Permitir cancelar se não quiser

---

## ✅ **CONCLUSÃO**

**Bug identificado:** Filtro de período causa corridas não marcadas

**Correção:** Buscar TODAS as corridas não pagas ao dar baixa

**Arquivos a modificar:**
1. `src/pages/AdminDashboard.tsx` (linha ~3426)
2. `src/pages/EstablishmentDashboard.tsx` (linha ~1803)

**Impacto:** Zero corridas esquecidas após dar baixa

---

**Status:** 🔴 **BUG IDENTIFICADO**

**Correção:** ⏳ **Aguardando aplicação**

**Complexidade:** 🟢 **Baixa** (10-15 linhas por arquivo)

---

_Bug identificado: 21 de Setembro de 2026_
