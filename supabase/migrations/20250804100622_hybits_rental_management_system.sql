-- Location: supabase/migrations/20250804100622_hybits_rental_management_system.sql
-- Schema Analysis: Fresh project - no existing schema
-- Integration Type: Complete rental management system for Hybits company
-- Dependencies: Auth users for user relationships

-- 1. Custom Types
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'staff', 'accountant');
CREATE TYPE public.item_category AS ENUM ('plates', 'cups', 'glasses', 'cutlery', 'bowls', 'serving_dishes');
CREATE TYPE public.item_condition AS ENUM ('excellent', 'good', 'fair', 'damaged', 'out_of_service');
CREATE TYPE public.customer_type AS ENUM ('individual', 'corporate', 'event_company', 'restaurant');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'items_dispatched', 'items_returned', 'completed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE public.invoice_type AS ENUM ('rental', 'security_deposit', 'damage_charges', 'late_fee');
CREATE TYPE public.gst_rate AS ENUM ('0', '5', '12', '18', '28');
CREATE TYPE public.payment_method AS ENUM ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'online');

-- 2. Core Tables

-- User profiles table (intermediary for auth relationships)
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role public.user_role DEFAULT 'staff'::public.user_role,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Inventory items
CREATE TABLE public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category public.item_category NOT NULL,
    description TEXT,
    rental_price_per_day DECIMAL(10,2) NOT NULL,
    security_deposit DECIMAL(10,2) DEFAULT 0,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    condition public.item_condition DEFAULT 'excellent'::public.item_condition,
    location TEXT DEFAULT 'Main Warehouse',
    reorder_point INTEGER DEFAULT 10,
    supplier TEXT,
    unit_cost DECIMAL(10,2),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code TEXT NOT NULL UNIQUE,
    company_name TEXT,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    gstin TEXT,
    customer_type public.customer_type DEFAULT 'individual'::public.customer_type,
    credit_limit DECIMAL(10,2) DEFAULT 0,
    outstanding_balance DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Rental orders
CREATE TABLE public.rental_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    delivery_date DATE NOT NULL,
    return_date DATE NOT NULL,
    delivery_address TEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    security_deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
    gst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status public.order_status DEFAULT 'pending'::public.order_status,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Rental order items
CREATE TABLE public.rental_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.rental_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    rental_days INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    returned_quantity INTEGER DEFAULT 0,
    damaged_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Invoices
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    order_id UUID REFERENCES public.rental_orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    invoice_type public.invoice_type DEFAULT 'rental'::public.invoice_type,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    gst_rate public.gst_rate DEFAULT '18'::public.gst_rate,
    gst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_received DECIMAL(10,2) DEFAULT 0,
    balance_due DECIMAL(10,2) DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Invoice items
CREATE TABLE public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    gst_rate public.gst_rate DEFAULT '18'::public.gst_rate,
    gst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT NOT NULL UNIQUE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    reference_number TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Stock movements (for tracking inventory changes)
CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL, -- 'in', 'out', 'adjustment', 'damage', 'return'
    quantity INTEGER NOT NULL,
    reference_type TEXT, -- 'order', 'adjustment', 'purchase'
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX idx_inventory_items_location ON public.inventory_items(location);
CREATE INDEX idx_inventory_items_condition ON public.inventory_items(condition);
CREATE INDEX idx_customers_customer_type ON public.customers(customer_type);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_rental_orders_customer_id ON public.rental_orders(customer_id);
CREATE INDEX idx_rental_orders_status ON public.rental_orders(status);
CREATE INDEX idx_rental_orders_event_date ON public.rental_orders(event_date);
CREATE INDEX idx_rental_order_items_order_id ON public.rental_order_items(order_id);
CREATE INDEX idx_rental_order_items_item_id ON public.rental_order_items(item_id);
CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX idx_invoices_is_paid ON public.invoices(is_paid);
CREATE INDEX idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date);
CREATE INDEX idx_stock_movements_item_id ON public.stock_movements(item_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at);

-- 4. Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 5. Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin_from_auth()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid() 
    AND (au.raw_user_meta_data->>'role' = 'admin' 
         OR au.raw_app_meta_data->>'role' = 'admin')
)
$$;

CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role::TEXT = required_role
)
$$;

-- 6. RLS Policies

-- User profiles - Pattern 1: Core user table
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin can view all profiles
CREATE POLICY "admin_full_access_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_admin_from_auth())
WITH CHECK (public.is_admin_from_auth());

-- Inventory items - Public read, authenticated write with role check
CREATE POLICY "public_can_read_inventory_items"
ON public.inventory_items
FOR SELECT
TO public
USING (true);

CREATE POLICY "authenticated_manage_inventory_items"
ON public.inventory_items
FOR ALL
TO authenticated
USING (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'))
WITH CHECK (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'));

-- Customers - Authenticated users can manage
CREATE POLICY "authenticated_manage_customers"
ON public.customers
FOR ALL
TO authenticated
USING (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'))
WITH CHECK (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'));

-- Rental orders - Authenticated users can manage
CREATE POLICY "authenticated_manage_rental_orders"
ON public.rental_orders
FOR ALL
TO authenticated
USING (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'))
WITH CHECK (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'));

-- Rental order items - Authenticated users can manage
CREATE POLICY "authenticated_manage_rental_order_items"
ON public.rental_order_items
FOR ALL
TO authenticated
USING (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'))
WITH CHECK (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'));

-- Invoices - Authenticated users can manage
CREATE POLICY "authenticated_manage_invoices"
ON public.invoices
FOR ALL
TO authenticated
USING (public.has_role('admin') OR public.has_role('manager') OR public.has_role('accountant'))
WITH CHECK (public.has_role('admin') OR public.has_role('manager') OR public.has_role('accountant'));

-- Invoice items - Authenticated users can manage
CREATE POLICY "authenticated_manage_invoice_items"
ON public.invoice_items
FOR ALL
TO authenticated
USING (public.has_role('admin') OR public.has_role('manager') OR public.has_role('accountant'))
WITH CHECK (public.has_role('admin') OR public.has_role('manager') OR public.has_role('accountant'));

-- Payments - Authenticated users can manage
CREATE POLICY "authenticated_manage_payments"
ON public.payments
FOR ALL
TO authenticated
USING (public.has_role('admin') OR public.has_role('manager') OR public.has_role('accountant'))
WITH CHECK (public.has_role('admin') OR public.has_role('manager') OR public.has_role('accountant'));

-- Stock movements - Authenticated users can manage
CREATE POLICY "authenticated_manage_stock_movements"
ON public.stock_movements
FOR ALL
TO authenticated
USING (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'))
WITH CHECK (public.has_role('admin') OR public.has_role('manager') OR public.has_role('staff'));

-- 7. Functions for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::public.user_role
  );  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Update functions for inventory
CREATE OR REPLACE FUNCTION public.update_inventory_quantities()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update available quantity when reserved changes
  UPDATE public.inventory_items 
  SET available_quantity = total_quantity - reserved_quantity,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.item_id;
  
  RETURN NEW;
END;
$$;

-- 9. Mock Data
DO $$
DECLARE
    admin_uuid UUID := gen_random_uuid();
    manager_uuid UUID := gen_random_uuid();
    staff_uuid UUID := gen_random_uuid();
    customer1_uuid UUID := gen_random_uuid();
    customer2_uuid UUID := gen_random_uuid();
    item1_uuid UUID := gen_random_uuid();
    item2_uuid UUID := gen_random_uuid();
    item3_uuid UUID := gen_random_uuid();
    item4_uuid UUID := gen_random_uuid();
    item5_uuid UUID := gen_random_uuid();
    order1_uuid UUID := gen_random_uuid();
BEGIN
    -- Create auth users with required fields
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'admin@hybits.in', crypt('admin123', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Rajesh Kumar", "role": "admin"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (manager_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'manager@hybits.in', crypt('manager123', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Priya Sharma", "role": "manager"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (staff_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'staff@hybits.in', crypt('staff123', gen_salt('bf', 10)), now(), now(), now(),
         '{"full_name": "Amit Patel", "role": "staff"}'::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null);

    -- Create customers
    INSERT INTO public.customers (id, customer_code, company_name, contact_person, phone, email, address, gstin, customer_type) VALUES
        (customer1_uuid, 'CUST-001', 'Golden Banquet Hall', 'Suresh Gupta', '+91-9876543210', 'suresh@goldenbanquet.com', '123 Wedding Street, Delhi 110001', '07AAACG1234F1Z5', 'corporate'::public.customer_type),
        (customer2_uuid, 'CUST-002', 'Raj Catering Services', 'Meera Singh', '+91-9876543211', 'meera@rajcatering.com', '456 Food Plaza, Mumbai 400001', '27AAACR5678G1Z3', 'event_company'::public.customer_type);

    -- Create inventory items
    INSERT INTO public.inventory_items (id, item_code, name, category, description, rental_price_per_day, security_deposit, total_quantity, available_quantity, condition, location, reorder_point, supplier, unit_cost, created_by) VALUES
        (item1_uuid, 'PLT-001', 'Dinner Plates - Large', 'plates'::public.item_category, 'Premium ceramic dinner plates, 12 inch diameter', 5.00, 2.00, 100, 85, 'good'::public.item_condition, 'Main Warehouse', 20, 'Ceramic Works Ltd', 150.00, admin_uuid),
        (item2_uuid, 'CUP-001', 'Tea Cups - Standard', 'cups'::public.item_category, 'White porcelain tea cups with saucers', 3.00, 1.50, 50, 42, 'good'::public.item_condition, 'Main Warehouse', 15, 'Porcelain India', 75.00, admin_uuid),
        (item3_uuid, 'GLS-001', 'Water Glasses', 'glasses'::public.item_category, 'Clear glass water glasses, 250ml capacity', 2.00, 1.00, 80, 80, 'excellent'::public.item_condition, 'Main Warehouse', 25, 'Glass Craft Co', 45.00, admin_uuid),
        (item4_uuid, 'CUT-001', 'Stainless Steel Cutlery Set', 'cutlery'::public.item_category, 'Complete cutlery set with fork, knife, spoon', 8.00, 3.00, 200, 170, 'excellent'::public.item_condition, 'Delhi Branch', 50, 'Steel Works India', 200.00, admin_uuid),
        (item5_uuid, 'BWL-001', 'Serving Bowls - Medium', 'bowls'::public.item_category, 'Ceramic serving bowls for curry and rice', 4.00, 2.00, 60, 52, 'good'::public.item_condition, 'Bangalore Hub', 30, 'Ceramic Works Ltd', 120.00, admin_uuid);

    -- Create a sample rental order
    INSERT INTO public.rental_orders (id, order_number, customer_id, event_date, delivery_date, return_date, delivery_address, total_amount, security_deposit, gst_amount, status, created_by) VALUES
        (order1_uuid, 'ORD-001', customer1_uuid, '2025-01-15', '2025-01-14', '2025-01-16', '123 Wedding Street, Delhi 110001', 1180.00, 200.00, 180.00, 'confirmed'::public.order_status, admin_uuid);

    -- Create rental order items
    INSERT INTO public.rental_order_items (order_id, item_id, quantity, rental_days, unit_price, total_price) VALUES
        (order1_uuid, item1_uuid, 50, 2, 5.00, 500.00),
        (order1_uuid, item2_uuid, 25, 2, 3.00, 150.00),
        (order1_uuid, item3_uuid, 50, 2, 2.00, 200.00),
        (order1_uuid, item4_uuid, 25, 2, 8.00, 400.00);

    -- Update reserved quantities
    UPDATE public.inventory_items SET reserved_quantity = 15, available_quantity = 70 WHERE id = item1_uuid;
    UPDATE public.inventory_items SET reserved_quantity = 8, available_quantity = 34 WHERE id = item2_uuid;
    UPDATE public.inventory_items SET reserved_quantity = 30, available_quantity = 140 WHERE id = item4_uuid;
    UPDATE public.inventory_items SET reserved_quantity = 8, available_quantity = 44 WHERE id = item5_uuid;

END $$;