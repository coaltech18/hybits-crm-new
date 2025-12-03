-- ============================================================================
-- Migration: Mark Overdue Invoices Routine
-- ============================================================================
-- Creates a function to mark invoices as overdue based on due_date
-- and payment status. Can be called manually or scheduled via cron.
-- ============================================================================

-- Function to update invoice status to 'overdue' for invoices past due date
-- that are not fully paid
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS TABLE (
  invoice_id UUID,
  invoice_number TEXT,
  updated_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Update invoices that are past due date and not fully paid
  UPDATE public.invoices
  SET 
    payment_status = 'overdue',
    updated_at = NOW()
  WHERE 
    due_date < CURRENT_DATE
    AND payment_status IN ('pending', 'partial')
    AND payment_received < total_amount
    AND payment_status != 'overdue'; -- Avoid redundant updates

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Return summary of updated invoices
  RETURN QUERY
  SELECT 
    i.id AS invoice_id,
    i.invoice_number,
    v_count AS updated_count
  FROM public.invoices i
  WHERE 
    i.due_date < CURRENT_DATE
    AND i.payment_status = 'overdue'
    AND i.payment_received < i.total_amount
    AND i.updated_at >= NOW() - INTERVAL '1 minute' -- Only recently updated
  LIMIT v_count;

  RETURN;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO authenticated;

-- Grant execute permission to service_role for cron jobs
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;

-- Add comment
COMMENT ON FUNCTION public.mark_overdue_invoices() IS 
  'Marks invoices as overdue if they are past due date and not fully paid. Returns list of updated invoices.';

-- Optional: Create a cron job to run this daily at 2 AM
-- Uncomment the following lines if pg_cron extension is enabled:
-- SELECT cron.schedule(
--   'mark-overdue-invoices-daily',
--   '0 2 * * *', -- 2 AM every day
--   $$SELECT * FROM public.mark_overdue_invoices();$$
-- );

