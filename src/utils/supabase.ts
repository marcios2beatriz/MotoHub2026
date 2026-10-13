"use client";

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rqieirvzutdculcdsncb.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaWVpcnZ6dXRkY3VsY2RzbmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyMTYyNDgsImV4cCI6MjA1Mzc5MjI0OH0.CfI1c8-qvZMcLGWpj4OhJF9QthykJWBs71MuJdVSptI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});