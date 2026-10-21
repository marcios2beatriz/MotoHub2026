import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDelivery4300() {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('order_number', '4300')
    .order('created_at');

  if (error) {
    console.error('Erro:', error);
    return;
  }

  console.log(`\n📊 Encontradas ${data.length} corridas com orderNumber = 4300:\n`);
  data.forEach((d, idx) => {
    console.log(`\n[${idx + 1}] Corrida #4300:`);
    console.log(`  ID: ${d.id}`);
    console.log(`  Date: ${d.date}`);
    console.log(`  Time: ${d.time}`);
    console.log(`  Rider ID: ${d.rider_id}`);
    console.log(`  Establishment ID: ${d.establishment_id}`);
    console.log(`  Value: ${d.value}`);
    console.log(`  Status: ${d.status}`);
    console.log(`  Created At: ${d.created_at}`);
  });

  // Verificar se há IDs duplicados
  const ids = data.map(d => d.id);
  const uniqueIds = [...new Set(ids)];
  
  if (ids.length !== uniqueIds.length) {
    console.log(`\n⚠️ ATENÇÃO: A corrida #4300 tem IDs DUPLICADOS!`);
    console.log(`Total de registros: ${ids.length}`);
    console.log(`IDs únicos: ${uniqueIds.length}`);
    
    // Mostrar quais IDs estão duplicados
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    console.log(`IDs duplicados:`, [...new Set(duplicates)]);
  } else {
    console.log(`\n✅ Todos os IDs são únicos`);
  }
}

checkDelivery4300().then(() => process.exit(0));
