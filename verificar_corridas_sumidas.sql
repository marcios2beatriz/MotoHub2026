-- 🔍 SQL PARA VERIFICAR CORRIDAS SUMIDAS
-- Execute no Supabase SQL Editor

-- 1️⃣ Buscar as 4 corridas que faltam (order_number contém 1339, 1226, 4765, 9042)
SELECT 
  id,
  order_number,
  time,
  value,
  status,
  date,
  rider_id,
  establishment_id
FROM deliveries
WHERE 
  date = '2026-10-12'
  AND (
    order_number LIKE '%1339%' OR
    order_number LIKE '%1226%' OR
    order_number LIKE '%4765%' OR
    order_number LIKE '%9042%'
  )
ORDER BY time ASC;

-- 2️⃣ Contar TODAS as corridas do dia 12/10/2026
SELECT 
  COUNT(*) as total_corridas,
  COUNT(DISTINCT order_number) as pedidos_unicos,
  status,
  COUNT(*) as por_status
FROM deliveries
WHERE date = '2026-10-12'
GROUP BY status;

-- 3️⃣ Listar TODAS as 21 corridas do dia (ordenadas por horário)
SELECT 
  ROW_NUMBER() OVER (ORDER BY time ASC) as numero,
  order_number,
  time,
  value,
  status,
  establishment_id
FROM deliveries
WHERE date = '2026-10-12'
ORDER BY time ASC;

-- 4️⃣ Verificar se há order_number com JSON especial
SELECT 
  id,
  order_number,
  time,
  LENGTH(order_number) as tamanho,
  CASE 
    WHEN order_number LIKE '{%' THEN 'JSON'
    WHEN order_number ~ '^\d+$' THEN 'NUMERO'
    ELSE 'OUTRO'
  END as tipo
FROM deliveries
WHERE date = '2026-10-12'
ORDER BY time ASC;
