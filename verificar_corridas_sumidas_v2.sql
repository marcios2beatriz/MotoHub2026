-- 🔍 INVESTIGAÇÃO DAS 4 CORRIDAS SUMIDAS
-- Execute no Supabase SQL Editor

-- 1️⃣ Buscar as 4 corridas específicas (#1339, #1226, #4765, #9042)
SELECT 
  id,
  order_number,
  time,
  value,
  status,
  date,
  to_char(date, 'DD/MM/YYYY') as date_formatted,
  rider_id,
  establishment_id,
  created_at,
  updated_at
FROM public.deliveries
WHERE 
  date = '2026-10-12'
  AND (
    order_number LIKE '%1339%' OR
    order_number LIKE '%1226%' OR
    order_number LIKE '%4765%' OR
    order_number LIKE '%9042%'
  )
ORDER BY time ASC;

-- 2️⃣ Ver TODAS as corridas do dia 12/10 ordenadas por horário
-- (para comparar com as 96 que chegam do banco)
SELECT 
  ROW_NUMBER() OVER (ORDER BY time ASC) as numero_sequencial,
  id,
  order_number,
  time,
  value,
  status,
  establishment_id
FROM public.deliveries
WHERE date = '2026-10-12'
ORDER BY time ASC
LIMIT 100;

-- 3️⃣ Contar corridas por status
SELECT 
  COUNT(*) as total,
  status
FROM public.deliveries
WHERE date = '2026-10-12'
GROUP BY status;

-- 4️⃣ Verificar se as 4 corridas existem COM OUTRA DATA
SELECT 
  id,
  order_number,
  date,
  to_char(date, 'DD/MM/YYYY') as date_formatted,
  time,
  value,
  status
FROM public.deliveries
WHERE 
  order_number LIKE '%1339%' OR
  order_number LIKE '%1226%' OR
  order_number LIKE '%4765%' OR
  order_number LIKE '%9042%'
ORDER BY date DESC, time ASC;
