-- SQL de configuração e criação de tabelas para o MotoHub Delivery no Supabase

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  phone TEXT,
  cpf TEXT,
  password_hash TEXT,
  must_reset_password BOOLEAN DEFAULT false,
  establishment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.establishments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  active BOOLEAN DEFAULT true,
  phone TEXT,
  address JSONB,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.schedules (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  date DATE NOT NULL,
  shift TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  chat TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  value NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  schedule_id TEXT,
  order_number TEXT,
  notes TEXT,
  customer_chat TEXT,
  paid BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.rider_queue (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  date DATE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  status TEXT NOT NULL DEFAULT 'waiting',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.partner_requests (
  id TEXT PRIMARY KEY,
  establishment_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.rider_locations (
  rider_id TEXT PRIMARY KEY,
  rider_name TEXT NOT NULL,
  lat NUMERIC(10,6) NOT NULL,
  lng NUMERIC(10,6) NOT NULL,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Desativa RLS para permitir leitura e escrita públicas cliente
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_locations DISABLE ROW LEVEL SECURITY;