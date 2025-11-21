-- ============================================
-- PAYMENTS & INVOICING SYSTEM FOR AWARDS CMS
-- ============================================

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,

  -- Relationships
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  award_id UUID REFERENCES awards(id) ON DELETE SET NULL,

  -- Invoice Details
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  invoice_type VARCHAR(50) NOT NULL, -- 'entry_fee', 'package', 'sponsorship', 'tickets', 'other'
  package_type VARCHAR(50), -- 'bronze', 'silver', 'gold', 'non-attendee'

  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5,2) DEFAULT 20.00, -- VAT/Tax percentage
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(10,2) DEFAULT 0.00,
  balance_due DECIMAL(10,2) DEFAULT 0.00,

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded'
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid', 'refunded', 'cancelled'

  -- Additional Info
  description TEXT,
  notes TEXT, -- Internal notes
  terms TEXT, -- Payment terms
  footer_text TEXT, -- Footer message on invoice

  -- Contact Details (snapshot at invoice creation)
  billing_contact_name VARCHAR(255),
  billing_email VARCHAR(255),
  billing_phone VARCHAR(50),
  billing_address TEXT,

  -- Tracking
  sent_date TIMESTAMPTZ,
  viewed_date TIMESTAMPTZ,
  paid_date TIMESTAMPTZ,
  reminder_sent_count INTEGER DEFAULT 0,
  last_reminder_sent TIMESTAMPTZ,

  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVOICE LINE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,

  -- Line Item Details
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,

  -- Sorting
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_reference VARCHAR(100) UNIQUE NOT NULL,

  -- Relationships
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,

  -- Payment Details
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'GBP',

  -- Payment Method
  payment_method VARCHAR(50) NOT NULL, -- 'bank_transfer', 'card', 'paypal', 'stripe', 'cash', 'cheque', 'other'
  payment_gateway VARCHAR(50), -- 'stripe', 'paypal', etc.
  transaction_id VARCHAR(255), -- External transaction ID from payment gateway

  -- Status
  status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded', 'cancelled'

  -- Additional Info
  notes TEXT,
  receipt_url TEXT, -- Link to receipt/proof of payment

  -- Refund Info
  refunded_amount DECIMAL(10,2) DEFAULT 0.00,
  refund_date DATE,
  refund_reason TEXT,

  -- Metadata
  processed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENT REMINDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,

  -- Reminder Details
  reminder_type VARCHAR(50) NOT NULL, -- 'gentle', 'standard', 'urgent', 'final_notice'
  sent_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_to VARCHAR(255) NOT NULL,

  -- Content
  subject VARCHAR(500),
  message TEXT,

  -- Status
  delivered BOOLEAN DEFAULT false,
  opened BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_organisation ON invoices(organisation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_event ON invoices(event_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_line_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_organisation ON payments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(payment_reference);

CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON payment_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_sent_date ON payment_reminders(sent_date);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  current_year VARCHAR(4);
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)
  ), 0) + 1 INTO next_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || current_year || '-%';

  RETURN 'INV-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate payment reference
CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  current_year VARCHAR(4);
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(payment_reference FROM '\d+$') AS INTEGER)
  ), 0) + 1 INTO next_num
  FROM payments
  WHERE payment_reference LIKE 'PAY-' || current_year || '-%';

  RETURN 'PAY-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice balance
CREATE OR REPLACE FUNCTION update_invoice_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate balance due
  NEW.balance_due := NEW.total_amount - NEW.paid_amount;

  -- Update payment status based on amounts
  IF NEW.paid_amount = 0 THEN
    NEW.payment_status := 'unpaid';
  ELSIF NEW.paid_amount >= NEW.total_amount THEN
    NEW.payment_status := 'paid';
    IF NEW.paid_date IS NULL THEN
      NEW.paid_date := NOW();
    END IF;
  ELSE
    NEW.payment_status := 'partial';
  END IF;

  -- Update status to overdue if past due date and not paid
  IF NEW.due_date < CURRENT_DATE AND NEW.payment_status != 'paid' THEN
    NEW.status := 'overdue';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice total when line items change
CREATE OR REPLACE FUNCTION update_invoice_total_from_items()
RETURNS TRIGGER AS $$
DECLARE
  invoice_subtotal DECIMAL(10,2);
  invoice_record RECORD;
BEGIN
  -- Get the invoice_id (works for INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO invoice_record FROM invoices WHERE id = OLD.invoice_id;
  ELSE
    SELECT * INTO invoice_record FROM invoices WHERE id = NEW.invoice_id;
  END IF;

  -- Calculate subtotal from all line items
  SELECT COALESCE(SUM(line_total), 0.00) INTO invoice_subtotal
  FROM invoice_line_items
  WHERE invoice_id = invoice_record.id;

  -- Update invoice with new calculations
  UPDATE invoices
  SET
    subtotal = invoice_subtotal,
    tax_amount = invoice_subtotal * (tax_rate / 100),
    total_amount = invoice_subtotal + (invoice_subtotal * (tax_rate / 100)) - discount_amount,
    updated_at = NOW()
  WHERE id = invoice_record.id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger for invoice balance updates
DROP TRIGGER IF EXISTS trigger_update_invoice_balance ON invoices;
CREATE TRIGGER trigger_update_invoice_balance
  BEFORE UPDATE OF paid_amount, total_amount ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_balance();

-- Trigger for updating invoice totals when line items change
DROP TRIGGER IF EXISTS trigger_update_invoice_total_insert ON invoice_line_items;
CREATE TRIGGER trigger_update_invoice_total_insert
  AFTER INSERT ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total_from_items();

DROP TRIGGER IF EXISTS trigger_update_invoice_total_update ON invoice_line_items;
CREATE TRIGGER trigger_update_invoice_total_update
  AFTER UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total_from_items();

DROP TRIGGER IF EXISTS trigger_update_invoice_total_delete ON invoice_line_items;
CREATE TRIGGER trigger_update_invoice_total_delete
  AFTER DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total_from_items();

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View: Invoices with organisation details and payment summary
CREATE OR REPLACE VIEW invoices_with_details AS
SELECT
  i.*,
  o.company_name,
  o.email as org_email,
  o.contact_phone as org_phone,
  COUNT(DISTINCT p.id) as payment_count,
  STRING_AGG(DISTINCT p.payment_method, ', ') as payment_methods,
  CASE
    WHEN i.due_date < CURRENT_DATE AND i.payment_status != 'paid' THEN true
    ELSE false
  END as is_overdue,
  CURRENT_DATE - i.due_date as days_overdue
FROM invoices i
LEFT JOIN organisations o ON i.organisation_id = o.id
LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
GROUP BY i.id, o.company_name, o.email, o.contact_phone;

-- View: Payment summary by organisation
CREATE OR REPLACE VIEW payment_summary_by_organisation AS
SELECT
  o.id as organisation_id,
  o.company_name,
  COUNT(DISTINCT i.id) as total_invoices,
  SUM(i.total_amount) as total_invoiced,
  SUM(i.paid_amount) as total_paid,
  SUM(i.balance_due) as total_outstanding,
  COUNT(DISTINCT CASE WHEN i.payment_status = 'paid' THEN i.id END) as paid_invoices,
  COUNT(DISTINCT CASE WHEN i.payment_status = 'unpaid' THEN i.id END) as unpaid_invoices,
  COUNT(DISTINCT CASE WHEN i.status = 'overdue' THEN i.id END) as overdue_invoices
FROM organisations o
LEFT JOIN invoices i ON o.id = i.organisation_id
GROUP BY o.id, o.company_name;

-- ============================================
-- SUCCESS!
-- ============================================
SELECT
  'Payment & Invoice System Installed Successfully!' as message,
  'Tables: invoices, invoice_line_items, payments, payment_reminders' as tables,
  'Functions: generate_invoice_number(), generate_payment_reference()' as functions,
  'Views: invoices_with_details, payment_summary_by_organisation' as views;
