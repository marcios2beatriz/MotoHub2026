/**
 * Wrapper para operações via Supabase Edge Function
 * Usa service_role key no servidor para bypassar limitações de RLS
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rqieirvzutdculcdsncb.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/delivery-operations`;

interface EdgeFunctionRequest {
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  table: string;
  data?: any;
  id?: string;
  filters?: Record<string, any>;
}

export async function callEdgeFunction(request: EdgeFunctionRequest) {
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(request)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Edge Function error:', result);
      throw new Error(result.error || 'Edge Function failed');
    }

    return result;
  } catch (error) {
    console.error('Failed to call Edge Function:', error);
    throw error;
  }
}

// Helpers específicos
export const edgeInsert = (table: string, data: any) => 
  callEdgeFunction({ operation: 'insert', table, data });

export const edgeUpdate = (table: string, data: any, id: string) => 
  callEdgeFunction({ operation: 'update', table, data, id });

export const edgeUpsert = (table: string, data: any) => 
  callEdgeFunction({ operation: 'upsert', table, data });

export const edgeDelete = (table: string, id: string) => 
  callEdgeFunction({ operation: 'delete', table, id });
