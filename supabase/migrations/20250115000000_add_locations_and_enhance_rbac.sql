-- Multi-Location Support Migration
-- This migration adds comprehensive multi-location support to the Hybits CRM system

-- 1. Create locations table
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    manager_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create location_users junction table for access control
CREATE TABLE public.location_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'manager', -- 'manager', 'viewer'
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, user_id)
);

-- 3. Add location_id to existing tables
ALTER TABLE public.inventory_items 
ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.customers 
ADD COLUMN primary_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.rental_orders 
ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.invoices 
ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.payments 
ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements 
ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- 6. Create indexes for performance
CREATE INDEX idx_locations_city ON public.locations(city);
CREATE INDEX idx_locations_state ON public.locations(state);
CREATE INDEX idx_locations_is_active ON public.locations(is_active);
CREATE INDEX idx_user_location_access_user_id ON public.user_location_access(user_id);
CREATE INDEX idx_user_location_access_location_id ON public.user_location_access(location_id);
CREATE INDEX idx_inventory_items_location_id ON public.inventory_items(location_id);
CREATE INDEX idx_rental_orders_location_id ON public.rental_orders(location_id);
CREATE INDEX idx_customers_location_id ON public.customers(location_id);

-- 7. Enable RLS on new tables
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_location_access ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for locations
-- Users can read all active locations
CREATE POLICY "users_can_read_active_locations"
ON public.locations
FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins and managers can manage locations
CREATE POLICY "admins_managers_can_manage_locations"
ON public.locations
FOR ALL
TO authenticated
USING (public.has_role('admin') OR public.has_role('manager'))
WITH CHECK (public.has_role('admin') OR public.has_role('manager'));

-- 9. Create RLS policies for user_location_access
-- Users can read their own location access
CREATE POLICY "users_can_read_own_location_access"
ON public.user_location_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all location access
CREATE POLICY "admins_can_manage_location_access"
ON public.user_location_access
FOR ALL
TO authenticated
USING (public.has_role('admin'))
WITH CHECK (public.has_role('admin'));

-- 10. Create helper functions for location-based access
CREATE OR REPLACE FUNCTION public.user_has_location_access(location_id UUID, access_level TEXT DEFAULT 'read')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_location_access ula
    WHERE ula.user_id = auth.uid() 
    AND ula.location_id = user_has_location_access.location_id
    AND (
        ula.access_level = 'admin' OR
        (ula.access_level = 'write' AND user_has_location_access.access_level IN ('read', 'write')) OR
        (ula.access_level = 'read' AND user_has_location_access.access_level = 'read')
    )
) OR public.has_role('admin')
$$;

CREATE OR REPLACE FUNCTION public.get_user_accessible_locations()
RETURNS TABLE(location_id UUID, location_name TEXT, access_level TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    l.id as location_id,
    l.name as location_name,
    COALESCE(ula.access_level, 'read') as access_level
FROM public.locations l
LEFT JOIN public.user_location_access ula ON l.id = ula.location_id AND ula.user_id = auth.uid()
WHERE l.is_active = true 
AND (
    public.has_role('admin') OR 
    ula.user_id IS NOT NULL
)
ORDER BY l.name
$$;

-- 11. Update existing RLS policies to include location-based access
-- Update inventory items policy
DROP POLICY IF EXISTS "authenticated_manage_inventory_items" ON public.inventory_items;
CREATE POLICY "authenticated_manage_inventory_items_with_location"
ON public.inventory_items
FOR ALL
TO authenticated
USING (
    public.has_role('admin') OR 
    public.has_role('manager') OR 
    public.has_role('staff')
)
WITH CHECK (
    public.has_role('admin') OR 
    public.has_role('manager') OR 
    public.has_role('staff')
);

-- Update rental orders policy
DROP POLICY IF EXISTS "authenticated_manage_rental_orders" ON public.rental_orders;
CREATE POLICY "authenticated_manage_rental_orders_with_location"
ON public.rental_orders
FOR ALL
TO authenticated
USING (
    public.has_role('admin') OR 
    public.has_role('manager') OR 
    public.has_role('staff')
)
WITH CHECK (
    public.has_role('admin') OR 
    public.has_role('manager') OR 
    public.has_role('staff')
);

-- 12. Insert default locations
INSERT INTO public.locations (location_code, name, address, city, state, pincode, phone, email, created_by) VALUES
('LOC-001', 'Main Warehouse - Mumbai', '123 Industrial Area, Andheri East', 'Mumbai', 'Maharashtra', '400069', '+91-22-12345678', 'mumbai@hybits.in', (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1)),
('LOC-002', 'Delhi Branch', '456 Business Park, Sector 18', 'Delhi', 'Delhi', '110018', '+91-11-87654321', 'delhi@hybits.in', (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1)),
('LOC-003', 'Bangalore Hub', '789 Tech City, Whitefield', 'Bangalore', 'Karnataka', '560066', '+91-80-11223344', 'bangalore@hybits.in', (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1)),
('LOC-004', 'Pune Center', '321 IT Park, Hinjewadi', 'Pune', 'Maharashtra', '411057', '+91-20-55667788', 'pune@hybits.in', (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1));

-- 13. Update existing inventory items to reference locations
UPDATE public.inventory_items 
SET location_id = (SELECT id FROM public.locations WHERE location_code = 'LOC-001' LIMIT 1)
WHERE location = 'Main Warehouse';

UPDATE public.inventory_items 
SET location_id = (SELECT id FROM public.locations WHERE location_code = 'LOC-002' LIMIT 1)
WHERE location = 'Delhi Branch';

UPDATE public.inventory_items 
SET location_id = (SELECT id FROM public.locations WHERE location_code = 'LOC-003' LIMIT 1)
WHERE location = 'Bangalore Hub';

-- 14. Grant location access to existing users
-- Admin gets access to all locations
INSERT INTO public.user_location_access (user_id, location_id, access_level, granted_by)
SELECT 
    up.id as user_id,
    l.id as location_id,
    'admin' as access_level,
    (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1) as granted_by
FROM public.user_profiles up
CROSS JOIN public.locations l
WHERE up.role = 'admin';

-- Manager gets access to all locations with write access
INSERT INTO public.user_location_access (user_id, location_id, access_level, granted_by)
SELECT 
    up.id as user_id,
    l.id as location_id,
    'write' as access_level,
    (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1) as granted_by
FROM public.user_profiles up
CROSS JOIN public.locations l
WHERE up.role = 'manager';

-- Staff gets read access to all locations
INSERT INTO public.user_location_access (user_id, location_id, access_level, granted_by)
SELECT 
    up.id as user_id,
    l.id as location_id,
    'read' as access_level,
    (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1) as granted_by
FROM public.user_profiles up
CROSS JOIN public.locations l
WHERE up.role = 'staff';

-- 15. Create function to get user's accessible locations for UI
CREATE OR REPLACE FUNCTION public.get_user_locations_for_ui()
RETURNS TABLE(
    id UUID,
    code TEXT,
    name TEXT,
    city TEXT,
    state TEXT,
    access_level TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    l.id,
    l.location_code as code,
    l.name,
    l.city,
    l.state,
    COALESCE(ula.access_level, 'read') as access_level
FROM public.locations l
LEFT JOIN public.user_location_access ula ON l.id = ula.location_id AND ula.user_id = auth.uid()
WHERE l.is_active = true 
AND (
    public.has_role('admin') OR 
    ula.user_id IS NOT NULL
)
ORDER BY l.name
$$;
