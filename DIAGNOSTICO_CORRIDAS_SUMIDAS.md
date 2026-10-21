# 🔍 DIAGNÓSTICO: Corridas Sumidas (12/10/2026 - Andrey)

## Problema
Das 21 corridas registradas no banco, apenas 17 aparecem na interface.

## Corridas que FALTAM na UI:
1. **#1339** - 18:55 - R$ 8.00 - (linha #3 do banco)
2. **#1226** - 21:12 - R$ 8.00 - (linha #13 do banco)
3. **#4765** - 21:12 - R$ 8.00 - (linha #12 do banco)
4. **#9042** - 23:02 - R$ 8.00 - (linha #21 do banco)

## Análise Inicial

### Padrão Identificado:
- ✅ As corridas **EXISTEM** no banco de dados
- ❌ NÃO aparecem na interface gráfica
- 🔍 **Hipótese**: Podem estar sendo filtradas no código TypeScript

### Possíveis Causas:

#### 1. **Parsing de `order_number` com JSON**
- A corrida #14 no banco tem: `{"o":"5576","t":"m","l":"1226"}`
- Isso significa "corrida #5576, mesmo endereço da #1226"
- ⚠️ A corrida **#1226** pode estar sendo ESCONDIDA por ser referenciada aqui

#### 2. **Deduplicação indevida**
- Código em `db.ts` linha ~224 tem comentário: "Deduplicar corridas"
- Pode estar removendo entradas "duplicadas" por engano

#### 3. **Filtro de status ou tipo**
- Todas as 4 corridas faltantes têm `status: 'active'`
- Pode haver um filtro que as está removendo

#### 4. **Race condition no carregamento**
- Pode ser problema de timing no `pullFromSupabase()`

## Próximos Passos

### 1. Verificar função `parseDeliveryRow` em `db.ts`
```typescript
function parseDeliveryRow(d: any): Delivery {
  let orderNumber: string | undefined = extractOrderNumberSafe(d.order_number);
  // ...
}
```
- ✅ Verificar se todas as corridas estão sendo parseadas corretamente

### 2. Verificar filtro `historyDeliveries` em `RiderDashboard.tsx` linha ~735
```typescript
const historyDeliveries = useMemo(() => {
  return deliveries.filter(d => {
    // AQUI pode estar filtrando indevidamente
  });
}, [deliveries, ...]);
```

### 3. Verificar se há deduplicação em `EstablishmentDashboard.tsx` linha ~224
```typescript
// 🔧 CORREÇÃO: Deduplicar corridas (evita duplicação por race condition realtime + pull)
```

### 4. Adicionar logs de debug temporários
```typescript
console.log('🔍 Corridas carregadas do banco:', db.getDeliveries().length);
console.log('🔍 Corridas após filtro:', historyDeliveries.length);
console.log('🔍 Corridas faltantes:', ['1339', '1226', '4765', '9042']);
```

## Solução Esperada
- **NENHUMA** corrida deve ser filtrada sem motivo explícito
- Todas as 21 corridas do banco devem aparecer na UI
- Se houver filtros, devem ser opcionais e configuráveis pelo usuário

---

**Data do diagnóstico:** 15/10/2026
**Desenvolvedor:** Kiro AI
