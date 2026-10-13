# 🚨 Solução Temporária - Inserir Corridas via SQL

Enquanto não resolvemos o erro 401, você pode inserir corridas **diretamente no Supabase SQL Editor**:

## 📋 Como inserir uma corrida manualmente:

1. **Acesse o SQL Editor do Supabase:**
   https://supabase.com/dashboard/project/rqieirvzutdculcdsncb/sql/new

2. **Cole este SQL** (modificando os valores):

```sql
INSERT INTO deliveries (
  id,
  rider_id,
  establishment_id,
  date,
  time,
  value,
  status,
  schedule_id,
  order_number
) VALUES (
  'delivery_' || extract(epoch from now())::text,  -- ID único automático
  'r_xxxxxxxxxxxx',  -- COLE O ID DO MOTOBOY AQUI
  'e_1786041335522',  -- Burgrill (seu estabelecimento)
  '2026-10-13',  -- Data de hoje
  '20:00',  -- Horário
  10.00,  -- Valor da corrida
  'pending',  -- Status inicial
  NULL,  -- schedule_id (opcional)
  '#123'  -- Número do pedido (opcional)
);
```

3. **Clique em "Run"**

## 📝 Como pegar o ID do motoboy:

Execute este SQL para listar todos os motoboys:

```sql
SELECT id, name, email 
FROM users 
WHERE role = 'rider' 
  AND active = true
ORDER BY name;
```

Copie o `id` do motoboy que você quer e cole no INSERT acima.

---

## ⚠️ ISSO É TEMPORÁRIO!

Estamos trabalhando para resolver o problema 401 definitivamente.

O problema está na autenticação da API do Supabase com a anon/publishable key.

Próximos passos que vou tentar:
1. Verificar se a Edge Function foi deployada corretamente
2. Forçar Vercel a fazer build limpo (sem cache)
3. Se nada funcionar, migrar para service_role key (menos seguro mas funciona)
```
