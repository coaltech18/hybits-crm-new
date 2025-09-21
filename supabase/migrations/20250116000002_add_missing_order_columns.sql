-- ============================================================================
-- ADD MISSING ORDER COLUMNS
-- ============================================================================

-- Add missing columns to rental_orders table
ALTER TABLE public.rental_orders 
ADD COLUMN IF NOT EXISTS event_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'other',
ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'indoor';

-- Add constraints for the new columns
ALTER TABLE public.rental_orders 
ADD CONSTRAINT check_event_duration CHECK (event_duration >= 0),
ADD CONSTRAINT check_guest_count CHECK (guest_count >= 0),
ADD CONSTRAINT check_event_type CHECK (event_type IN ('wedding', 'corporate', 'birthday', 'anniversary', 'other')),
ADD CONSTRAINT check_location_type CHECK (location_type IN ('indoor', 'outdoor', 'both'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rental_orders_event_type ON public.rental_orders(event_type);
CREATE INDEX IF NOT EXISTS idx_rental_orders_location_type ON public.rental_orders(location_type);
CREATE INDEX IF NOT EXISTS idx_rental_orders_event_duration ON public.rental_orders(event_duration);
