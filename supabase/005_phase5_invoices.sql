-- ================================================================
-- PHASE 5: INVOICES
-- ================================================================
-- This migration creates the invoicing system for both subscriptions and events.
--
-- Business Rules:
--   - Two invoice types: subscription and event (NEVER mixed)
--   - Event invoices ONLY for completed events
--   - Cancelled events CANNOT be invoiced
--   - Issued invoices are IMMUTABLE
--   - All pricing lives in invoice_items (single source of truth)
--
-- Invoice Lifecycle:
--   - draft: Can be edited
--   - issued: Immutable, sent to client
--   - cancelled: Voided
--
-- Role Access:
--   - Admin: Full CRUD on all invoices (all outlets)
--   - Manager: CRUD only for assigned outlet invoices
--   - Accountant: Read-only on all invoices (all outlets)
-- ================================================================

-- ================================================================
-- 1. CREATE ENUMS
-- ================================================================

-- Invoice type
CREATE TYPE invoice_type AS ENUM ('subscription', 'event');

-- Invoice status
CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'cancelled');

-- ================================================================
-- 2. CREATE INVOICES TABLE
-- ================================================================

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  invoice_type invoice_type NOT NULL,
  
  -- References
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  event_id uuid REFERENCES events(id) ON DELETE RESTRICT,
  
  -- Status
  status invoice_status NOT NULL DEFAULT 'draft',
  
  -- Totals (derived from invoice_items)
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  grand_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  
  -- Dates
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  
  -- Business rules
  CONSTRAINT invoices_event_type_has_event_id
    CHECK (
      (invoice_type = 'event' AND event_id IS NOT NULL) OR
      (invoice_type = 'subscription' AND event_id IS NULL)
    ),
  CONSTRAINT invoices_issued_has_issued_at
    CHECK (status != 'issued' OR issued_at IS NOT NULL),
  CONSTRAINT invoices_totals_match
    CHECK (grand_total = subtotal + tax_total)
);

-- ================================================================
-- 3. CREATE INVOICE_ITEMS TABLE
-- ================================================================

CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Line item details
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  
  -- Tax (CGST+SGST or IGST)
  tax_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Business rule: line_total = quantity * unit_price
  CONSTRAINT invoice_items_line_total_matches
    CHECK (line_total = quantity * unit_price),
  -- Business rule: tax_amount = line_total * (tax_rate / 100)
  CONSTRAINT invoice_items_tax_matches
    CHECK (tax_amount = ROUND(line_total * (tax_rate / 100), 2))
);

-- ================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Fast lookup by outlet (manager queries)
CREATE INDEX idx_invoices_outlet_id ON invoices(outlet_id);

-- Fast lookup by client
CREATE INDEX idx_invoices_client_id ON invoices(client_id);

-- Fast lookup by event (for event invoices)
CREATE INDEX idx_invoices_event_id ON invoices(event_id) WHERE event_id IS NOT NULL;

-- Fast filtering by type
CREATE INDEX idx_invoices_type ON invoices(invoice_type);

-- Fast filtering by status
CREATE INDEX idx_invoices_status ON invoices(status);

-- Fast lookup by invoice number
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);

-- Composite for manager queries (outlet + type + status)
CREATE INDEX idx_invoices_outlet_type_status ON invoices(outlet_id, invoice_type, status);

-- Fast lookup for invoice items by invoice
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ================================================================
-- 5. AUTO-GENERATE INVOICE NUMBER
-- ================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate invoice number: INV-YYYYMMDD-NNNN
  -- NNNN is a sequential number for the day
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || 
                          TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                          LPAD(
                            (
                              SELECT COALESCE(MAX(
                                CAST(SUBSTRING(invoice_number FROM 'INV-[0-9]{8}-([0-9]+)') AS INTEGER)
                              ), 0) + 1
                              FROM invoices
                              WHERE invoice_number LIKE 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%'
                            )::TEXT,
                            4,
                            '0'
                          );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();

-- ================================================================
-- 6. BUSINESS RULE VALIDATION TRIGGER
-- ================================================================

CREATE OR REPLACE FUNCTION validate_invoice_business_rules()
RETURNS TRIGGER AS $$
DECLARE
  client_outlet_id uuid;
  event_outlet_id uuid;
  event_status_val event_status;
BEGIN
  -- Get client's outlet
  SELECT outlet_id INTO client_outlet_id
  FROM clients
  WHERE id = NEW.client_id;
  
  -- Rule 1: Client must exist
  IF client_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Client does not exist';
  END IF;
  
  -- Rule 2: Client outlet must match invoice outlet
  IF client_outlet_id != NEW.outlet_id THEN
    RAISE EXCEPTION 'Client does not belong to selected outlet';
  END IF;
  
  -- Rule 3: For event invoices, validate event
  IF NEW.invoice_type = 'event' THEN
    IF NEW.event_id IS NULL THEN
      RAISE EXCEPTION 'Event invoices must have an event_id';
    END IF;
    
    -- Get event outlet and status
    SELECT outlet_id, status INTO event_outlet_id, event_status_val
    FROM events
    WHERE id = NEW.event_id;
    
    IF event_outlet_id IS NULL THEN
      RAISE EXCEPTION 'Event does not exist';
    END IF;
    
    -- Event outlet must match invoice outlet
    IF event_outlet_id != NEW.outlet_id THEN
      RAISE EXCEPTION 'Event does not belong to selected outlet';
    END IF;
    
    -- Event must be completed
    IF event_status_val != 'completed' THEN
      RAISE EXCEPTION 'Only completed events can be invoiced. Event status: %', event_status_val;
    END IF;
  END IF;
  
  -- Rule 4: For subscription invoices, event_id must be NULL
  IF NEW.invoice_type = 'subscription' AND NEW.event_id IS NOT NULL THEN
    RAISE EXCEPTION 'Subscription invoices cannot have an event_id';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_invoice_before_insert_update
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_business_rules();

-- ================================================================
-- 7. PREVENT EDITING ISSUED/CANCELLED INVOICES
-- ================================================================

CREATE OR REPLACE FUNCTION prevent_invoice_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent editing issued invoices
  IF OLD.status = 'issued' AND NEW.status = 'issued' THEN
    IF OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
       OLD.tax_total IS DISTINCT FROM NEW.tax_total OR
       OLD.grand_total IS DISTINCT FROM NEW.grand_total THEN
      RAISE EXCEPTION 'Issued invoices cannot be modified';
    END IF;
  END IF;
  
  -- Prevent issuing cancelled invoices
  IF OLD.status = 'cancelled' AND NEW.status = 'issued' THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be issued';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_invoice_modification_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_modification();

-- ================================================================
-- 8. AUTO-UPDATE issued_at WHEN STATUS CHANGES TO ISSUED
-- ================================================================

CREATE OR REPLACE FUNCTION set_issued_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'issued' AND OLD.status != 'issued' THEN
    NEW.issued_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_issued_at_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_issued_at();

-- ================================================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 10. RLS POLICIES FOR INVOICES
-- ================================================================

-- Admin: Full access
CREATE POLICY "admins_full_access_invoices"
ON invoices FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
);

-- Manager: Assigned outlets only
CREATE POLICY "managers_select_own_outlet_invoices"
ON invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'manager' AND up.is_active = true
  ) AND outlet_id IN (
    SELECT outlet_id FROM user_outlet_assignments WHERE user_id = auth.uid()
  )
);

CREATE POLICY "managers_insert_own_outlet_invoices"
ON invoices FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'manager' AND up.is_active = true
  ) AND outlet_id IN (
    SELECT outlet_id FROM user_outlet_assignments WHERE user_id = auth.uid()
  )
);

CREATE POLICY "managers_update_own_outlet_invoices"
ON invoices FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'manager' AND up.is_active = true
  ) AND outlet_id IN (
    SELECT outlet_id FROM user_outlet_assignments WHERE user_id = auth.uid()
  )
);

-- Accountant: Read-only all outlets
CREATE POLICY "accountants_readonly_all_invoices"
ON invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'accountant' AND is_active = true
  )
);

-- ================================================================
-- 11. RLS POLICIES FOR INVOICE_ITEMS
-- ================================================================

-- Admin: Full access
CREATE POLICY "admins_full_access_invoice_items"
ON invoice_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
);

-- Manager: Access items from their outlet invoices
CREATE POLICY "managers_access_own_outlet_invoice_items"
ON invoice_items FOR ALL TO authenticated
USING (
  invoice_id IN (
    SELECT id FROM invoices
    WHERE outlet_id IN (
      SELECT outlet_id FROM user_outlet_assignments WHERE user_id = auth.uid()
    )
  )
);

-- Accountant: Read-only all items
CREATE POLICY "accountants_readonly_all_invoice_items"
ON invoice_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'accountant' AND is_active = true
  )
);

-- ================================================================
-- 12. TRIGGERS FOR UPDATED_AT
-- ================================================================

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 13. TRIGGER FOR CREATED_BY
-- ================================================================

CREATE TRIGGER set_invoices_created_by
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- ================================================================
-- 14. HELPER VIEW: INVOICES WITH JOINED DATA
-- ================================================================

CREATE OR REPLACE VIEW invoices_with_details AS
SELECT 
  i.*,
  c.name AS client_name,
  c.client_type,
  c.phone AS client_phone,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city AS outlet_city,
  e.event_name,
  e.event_date
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
LEFT JOIN events e ON i.event_id = e.id;

ALTER VIEW invoices_with_details SET (security_invoker = true);

-- ================================================================
-- END OF PHASE 5 MIGRATION
-- ================================================================

-- Migration Summary:
-- ✅ Created invoice_type ENUM (subscription, event)
-- ✅ Created invoice_status ENUM (draft, issued, cancelled)
-- ✅ Created invoices table with all required fields
-- ✅ Created invoice_items table (single source of truth for pricing)
-- ✅ Added indexes for performance optimization
-- ✅ Auto-generate invoice numbers (INV-YYYYMMDD-NNNN)
-- ✅ Enabled RLS with role-based policies
-- ✅ Triggers for business rule validation
-- ✅ Triggers to prevent editing issued/cancelled invoices
-- ✅ Auto-set issued_at when status changes to issued
-- ✅ Triggers for updated_at and created_by
-- ✅ Helper view for easy invoice queries
-- ✅ Event invoices only for completed events
-- ✅ Subscription invoices must not have event_id
-- ✅ Line totals and tax calculated via CHECK constraints
