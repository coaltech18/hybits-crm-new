-- ==============================================================
-- 004 - Inventory and Movements
-- ==============================================================

CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT UNIQUE,
  item_name TEXT NOT NULL,
  category TEXT,
  unit_type TEXT DEFAULT 'piece',
  quantity NUMERIC(12,2) DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  hsn_code TEXT,
  description TEXT,
  location_id UUID REFERENCES public.locations(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type TEXT CHECK (movement_type IN ('in','out','return','damage')),
  quantity NUMERIC(12,2),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  location_id UUID REFERENCES public.locations(id)
);

CREATE OR REPLACE FUNCTION public.update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.movement_type = 'in' OR NEW.movement_type = 'return') THEN
    UPDATE public.inventory_items
      SET quantity = quantity + NEW.quantity
    WHERE id = NEW.item_id;
  ELSE
    UPDATE public.inventory_items
      SET quantity = quantity - NEW.quantity
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_update
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_movement();
