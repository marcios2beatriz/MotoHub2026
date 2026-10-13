// Supabase Edge Function para operações de delivery
// Usa service_role key para bypassar limitações de RLS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Cliente com service_role (permissões totais)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    const { operation, table, data, id, filters } = await req.json()

    let result
    
    switch (operation) {
      case 'insert':
        result = await supabase.from(table).insert(data).select()
        break
        
      case 'update':
        if (id) {
          result = await supabase.from(table).update(data).eq('id', id).select()
        } else if (filters) {
          let query = supabase.from(table).update(data)
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value)
          }
          result = await query.select()
        } else {
          throw new Error('Update requires id or filters')
        }
        break
        
      case 'upsert':
        result = await supabase.from(table).upsert(data, { onConflict: 'id' }).select()
        break
        
      case 'delete':
        if (id) {
          result = await supabase.from(table).delete().eq('id', id)
        } else if (filters) {
          let query = supabase.from(table).delete()
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value)
          }
          result = await query
        } else {
          throw new Error('Delete requires id or filters')
        }
        break
        
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }

    if (result.error) {
      console.error('Database error:', result.error)
      return new Response(
        JSON.stringify({ error: result.error.message, details: result.error }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ data: result.data, success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
