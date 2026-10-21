# 🐛 CORREÇÃO: Bug de Adicionais Contados em Dobro

## 📋 Resumo do Bug

**Problema identificado:** Os valores adicionais estavam sendo contados **DUAS VEZES** nos cálculos de ganhos dos motoboys.

### Como o bug acontecia:

1. **No cadastro da corrida:**
   - Usuário digitava: Valor base = R$ 8, Adicional = R$ 8
   - Sistema calculava: `totalVal = 8 + 8 = R$ 16`
   - Sistema gravava no banco: `value = 16` ❌
   - Sistema também gravava: `order_number = {"o":"1234","a":8}` (adicional no JSON)

2. **No cálculo dos ganhos:**
   - Sistema lia: `value = 16`
   - Sistema extraía do JSON: `additionalValue = 8`
   - Sistema calculava: `(16 - taxa) + 8 = contagem dupla do adicional!` ❌

---

## ✅ Correção Aplicada

### Arquivos corrigidos:
1. `src/components/BatchDeliveryModal.tsx` (linha 422)
2. `src/pages/AdminDashboard.tsx` (linhas 1085 e 1108)
3. `src/pages/RiderDashboard.tsx` (linhas 583 e 607)
4. `src/pages/EstablishmentDashboard.tsx` (linhas 855 e 875)

### Mudança:
```typescript
// ❌ ANTES (ERRADO):
value: baseVal + addVal,  // Ex: 8 + 8 = 16

// ✅ AGORA (CORRETO):
value: baseVal,  // Ex: apenas 8
additionalValue: addVal  // 8 separado no JSON
```

---

## 🚨 IMPORTANTE: Dados Antigos

### ⚠️ O problema:
**As corridas JÁ CADASTRADAS** no banco têm o valor errado no campo `value` (com adicional incluído).

**Exemplo real do Danilo:**
- Corrida #0360: `value = 16.00` (deveria ser 8.00), `additionalValue = 8`
- O sistema está somando: `16 - 1 + 8 = R$ 23` (ERRADO)
- Deveria somar: `8 - 1 + 8 = R$ 15` (CORRETO)

### 💰 Impacto financeiro:
- **Danilo (12/10 a 18/10):** Sistema mostra R$ 520, mas o correto seria menos
- **Todos os motoboys com adicionais** estão com valores INFLADOS

---

## 🔧 Solução para Dados Antigos

### Opção 1: Script de Correção (RECOMENDADO)

Execute este SQL no Supabase para corrigir os registros antigos:

```sql
-- ⚠️ BACKUP PRIMEIRO!
-- Crie uma cópia da tabela antes de executar:
CREATE TABLE deliveries_backup AS SELECT * FROM deliveries;

-- Corrigir valores onde há adicional no JSON
UPDATE deliveries
SET value = value - CAST(
    CASE 
        WHEN order_number LIKE '%"a":%' 
        THEN substring(order_number from '"a":([0-9.]+)')
        ELSE '0'
    END AS NUMERIC
)
WHERE order_number LIKE '%"a":%'
  AND status = 'active';

-- Verificar correção
SELECT 
    COUNT(*) as total_corrigidos,
    SUM(value) as soma_valores_corrigidos
FROM deliveries
WHERE order_number LIKE '%"a":%'
  AND status = 'active';
```

### Opção 2: Aceitar e Documentar (NÃO RECOMENDADO)

Se decidir NÃO corrigir os dados antigos:
- Documente que valores até data X estão com adicional incluído
- Novos cálculos a partir de hoje estarão corretos
- Pode gerar confusão e reclamações dos motoboys

---

## ✅ Validação

### Para testar se a correção está funcionando:

1. **Teste em desenvolvimento:**
   ```
   1. Cadastre uma corrida: R$ 8 + adicional R$ 5
   2. Verifique no banco: value = 8.00 (não 13.00)
   3. Verifique no dashboard: Líquido = 8 - 1 + 5 = R$ 12
   ```

2. **Console do navegador:**
   - Procure logs: `💰 [Nome]: XX corridas, Bruto: R$ XX, Adicionais: R$ XX, Líquido: R$ XX`
   - **NÃO deve aparecer:** `⚠️ ATENÇÃO: Divergência no cálculo!`

---

## 📊 Fórmula Correta de Cálculo

### Por corrida:
```
Líquido Motoboy = (Valor Base - Taxa Admin) + Adicional

Exemplo:
- Corrida R$ 8, Adicional R$ 5
- Líquido = (8 - 1) + 5 = R$ 12 ✅

Exemplo corrida de R$ 4 (isenta):
- Corrida R$ 4, Adicional R$ 3
- Líquido = (4 - 0) + 3 = R$ 7 ✅
```

---

## 📌 Commits Importantes

- **Ponto de restauração:** commit `aa6aaaf` - "PONTO DE RESTAURAÇÃO: Antes de corrigir bug de adicionais contados em dobro"
- **Correção aplicada:** commit `f01bf1a` - "FIX: Corrigido bug crítico de adicionais contados em dobro"

### Para reverter se necessário:
```bash
git revert f01bf1a
# OU
git reset --hard aa6aaaf
```

---

## 🎯 Próximos Passos

1. ✅ Teste a correção em desenvolvimento
2. ⚠️ **DECIDA:** Executar script de correção nos dados antigos?
3. ✅ Teste novamente após sincronizar com o Android
4. ✅ Comunique aos motoboys sobre possível ajuste nos valores (se corrigir dados antigos)

---

**Data da correção:** 2026-10-15
**Responsável:** Kiro AI Assistant
**Status:** ✅ Correção aplicada, aguardando decisão sobre dados antigos
