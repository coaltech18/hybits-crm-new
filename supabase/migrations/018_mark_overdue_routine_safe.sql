-- ============================================================================
-- Migration: Mark Overdue Invoices Routine (Safe, Idempotent)
-- ============================================================================
-- Creates or replaces the mark_overdue_invoices function that returns
-- the count of invoices marked as overdue.
-- Safe to re-run (idempotent).
-- ============================================================================

-- Drop existing function if it exists (needed when changing return type)
-- Migration 016 created a version that returns TABLE, this migration changes it to INTEGER
DROP FUNCTION IF EXISTS public.mark_overdue_invoices() CASCADE;

-- Function to update invoice status to 'overdue' for invoices past due date
-- that are not fully paid. Returns the count of invoices updated.
CREATE FUNCTION public.mark_overdue_invoices()
RETURNS integer 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  -- Update invoices that are past due date and not fully paid
  UPDATE public.invoices
  SET 
    payment_status = 'overdue',
    updated_at = NOW()
  WHERE 
    due_date IS NOT NULL
    AND due_date < CURRENT_DATE
    AND payment_status IN ('pending', 'partial')
    AND (payment_received IS NULL OR payment_received < total_amount)
    AND payment_status != 'overdue'; -- Avoid redundant updates

  -- Get the number of rows updated
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO authenticated;

-- Grant execute permission to service_role for cron jobs
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;

-- Add comment
COMMENT ON FUNCTION public.mark_overdue_invoices() IS 
  'Marks invoices as overdue when due_date passed and not fully paid; returns number of invoices marked overdue';

