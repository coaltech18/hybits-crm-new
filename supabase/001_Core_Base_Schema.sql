-- ==============================================================
-- 001 - Core Base Schema
-- ==============================================================

CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  pincode TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.users_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('admin','manager','accountant','viewer')),
  location_id UUID REFERENCES public.locations(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT,
  entity TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
