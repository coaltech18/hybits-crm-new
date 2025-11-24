-- ===================================================================
-- Fix ambiguous column reference in next_entity_seq function
-- ===================================================================

-- Fix the ambiguous last_seq reference in ON CONFLICT clause
-- In PostgreSQL, when using ON CONFLICT DO UPDATE, column names in the SET clause
-- refer to the existing row. To avoid ambiguity, we use the table name explicitly.
CREATE OR REPLACE FUNCTION public.next_entity_seq(
  p_entity TEXT,
  p_outlet UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  cur INTEGER;
BEGIN
  LOOP
    BEGIN
      -- Try UPDATE first
      UPDATE public.entity_sequences
      SET last_seq = entity_sequences.last_seq + 1, updated_at = NOW()
      WHERE entity = p_entity AND outlet_id IS NOT DISTINCT FROM p_outlet
      RETURNING entity_sequences.last_seq INTO cur;

      IF FOUND THEN
        RETURN cur;
      END IF;

      -- INSERT with ON CONFLICT - use table-qualified column name to avoid ambiguity
      INSERT INTO public.entity_sequences(entity, outlet_id, last_seq)
      VALUES (p_entity, p_outlet, 1)
      ON CONFLICT (entity, outlet_id) 
      DO UPDATE SET 
        last_seq = (SELECT last_seq FROM public.entity_sequences WHERE (entity, outlet_id) = (EXCLUDED.entity, EXCLUDED.outlet_id)) + 1,
        updated_at = NOW()
      RETURNING last_seq INTO cur;

      RETURN cur;
    EXCEPTION WHEN serialization_failure THEN
      PERFORM pg_sleep(0.01);
      CONTINUE;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

