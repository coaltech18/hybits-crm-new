-- 004_subscriptions_invoice_generator.sql
-- RPC to generate monthly invoices for active subscriptions

CREATE OR REPLACE FUNCTION public.generate_monthly_subscription_invoices(p_run_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(subscription_id UUID, invoice_id UUID, amount NUMERIC) AS $$
DECLARE
  rec RECORD;
  inv_id UUID;
  item_id UUID;
  billing_start DATE;
  billing_end DATE;
  days_in_period INTEGER;
  amount_val NUMERIC;
BEGIN
  FOR rec IN
    SELECT cs.*
    FROM public.customer_subscriptions cs
    WHERE cs.status = 'active'
      AND (cs.start_date <= p_run_date)
      AND (cs.end_date IS NULL OR cs.end_date >= p_run_date)
  LOOP
    billing_start := date_trunc('month', p_run_date)::date;
    billing_end := (date_trunc('month', p_run_date) + interval '1 month - 1 day')::date;
    -- handle partial month if subscription started later or ended earlier
    IF rec.start_date > billing_start THEN
      billing_start := rec.start_date;
    END IF;
    IF rec.end_date IS NOT NULL AND rec.end_date < billing_end THEN
      billing_end := rec.end_date;
    END IF;
    days_in_period := (billing_end - billing_start + 1);

    -- Create invoice
    INSERT INTO public.invoices (customer_id, order_id, outlet_id, invoice_type, invoice_date, due_date, subtotal, total_gst, total_amount, payment_received, payment_status, created_by)
    VALUES (rec.customer_id, NULL, rec.outlet_id, 'rental', p_run_date, billing_end + 7, 0, 0, 0, 0, 'pending', rec.created_by)
    RETURNING id INTO inv_id;

    -- Add invoice item: monthly subscription charge
    amount_val := (rec.quantity_per_day * rec.unit_price * days_in_period);
    INSERT INTO public.invoice_items (invoice_id, description, quantity, rate, gst_rate, amount)
    VALUES (inv_id, concat('Subscription ', rec.subscription_code, ' monthly charge'), (rec.quantity_per_day * days_in_period), rec.unit_price, COALESCE(rec.gst_rate::numeric,0), amount_val)
    RETURNING id INTO item_id;

    -- Update invoice totals
    UPDATE public.invoices
    SET subtotal = (SELECT SUM(amount) FROM public.invoice_items WHERE invoice_id = inv_id),
        total_gst = ROUND((SELECT SUM(amount) FROM public.invoice_items WHERE invoice_id = inv_id) * COALESCE(rec.gst_rate::numeric, 0) / 100, 2),
        total_amount = ROUND((SELECT SUM(amount) FROM public.invoice_items WHERE invoice_id = inv_id) * (1 + COALESCE(rec.gst_rate::numeric, 0)/100),2)
    WHERE id = inv_id;

    -- Link subscription_invoices
    INSERT INTO public.subscription_invoices (subscription_id, invoice_id, billing_period_start, billing_period_end)
    VALUES (rec.id, inv_id, billing_start, billing_end);

    subscription_id := rec.id;
    invoice_id := inv_id;
    amount := (SELECT total_amount FROM public.invoices WHERE id = inv_id);
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

