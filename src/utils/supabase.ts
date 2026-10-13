"use client";

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rqieirvzutdculcdsncb.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaWVpcnZ6dXRkY3VsY2RzbmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzA2NDgsImV4cCI6MjA5OTEwNjY0OH0.7-6uGuRhdtSnu5dHzTCJ7OgakHXhZmYPG1qVvCApdR4';

// Cliente Supabase para leitura (permite auth se existir)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Cliente Supabase EXCLUSIVO para escrita - FORÇA anon key sempre
export const supabaseWrite = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Prefer': 'return=representation'
    }
  }
});