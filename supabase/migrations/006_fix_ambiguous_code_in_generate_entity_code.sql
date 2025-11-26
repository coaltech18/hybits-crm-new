-- ===================================================================
-- Fix ambiguous column reference in generate_entity_code function
-- ===================================================================

-- Fix the ambiguous 'code' reference in the SELECT statement
-- The column 'code' needs to be qualified with the table name 'locations.code'
CREATE OR REPLACE FUNCTION public.generate_entity_code(
  p_entity TEXT,
  p_prefix TEXT,
  p_outlet_id UUID DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  seq INTEGER;
  outcode TEXT;
  code TEXT;
BEGIN
  seq := public.next_entity_seq(p_entity, p_outlet_id);

  IF p_outlet_id IS NOT NULL THEN
    -- Fixed: Use locations.code instead of just 'code' to avoid ambiguity
    SELECT UPPER(COALESCE(locations.code, 'OUT')) INTO outcode FROM public.locations WHERE id = p_outlet_id LIMIT 1;
    IF outcode IS NULL THEN
      outcode := 'OUT';
    END IF;
    code := UPPER(p_prefix) || '-' || outcode || '-' || LPAD(seq::text, 3, '0');
  ELSE
    code := UPPER(p_prefix) || '-' || LPAD(seq::text, 3, '0');
  END IF;

  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

