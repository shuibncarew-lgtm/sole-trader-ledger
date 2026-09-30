-- ============================================================
-- Sole Trader Ledger — Initial Schema
-- Phase 1: Database layer with debit=credit enforcement
-- ============================================================

-- 1. CHART OF ACCOUNTS
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Seed starter accounts for a small trading business
INSERT INTO chart_of_accounts (code, name, type, normal_balance) VALUES
  ('1000', 'Cash', 'asset', 'debit'),
  ('1010', 'Bank', 'asset', 'debit'),
  ('1100', 'Accounts Receivable', 'asset', 'debit'),
  ('2000', 'Accounts Payable', 'liability', 'credit'),
  ('3000', 'Owner''s Equity', 'equity', 'credit'),
  ('4000', 'Sales Revenue', 'revenue', 'credit'),
  ('5000', 'Rent Expense', 'expense', 'debit'),
  ('5010', 'Transport Expense', 'expense', 'debit'),
  ('5020', 'Supplies Expense', 'expense', 'debit'),
  ('5030', 'Utilities Expense', 'expense', 'debit'),
  ('5090', 'Other Expense', 'expense', 'debit')
ON CONFLICT (code) DO NOTHING;

-- 2. JOURNAL ENTRIES (header)
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'transaction_form', 'invoice', 'payment')),
  source_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  user_id UUID NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. JOURNAL ENTRY LINES
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  -- A line is never both a debit and a credit
  CONSTRAINT not_both_debit_and_credit CHECK (
    (debit_amount = 0 OR credit_amount = 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_jel_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);

-- 4. CATEGORY → ACCOUNT MAP (lookup table, not hardcoded logic)
CREATE TABLE IF NOT EXISTS category_account_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL UNIQUE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  direction TEXT NOT NULL CHECK (direction IN ('money_in', 'money_out'))
);

-- Seed category mappings
INSERT INTO category_account_map (category_name, account_id, direction)
SELECT 'Sales', id, 'money_in' FROM chart_of_accounts WHERE code = '4000'
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO category_account_map (category_name, account_id, direction)
SELECT 'Rent', id, 'money_out' FROM chart_of_accounts WHERE code = '5000'
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO category_account_map (category_name, account_id, direction)
SELECT 'Transport', id, 'money_out' FROM chart_of_accounts WHERE code = '5010'
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO category_account_map (category_name, account_id, direction)
SELECT 'Supplies', id, 'money_out' FROM chart_of_accounts WHERE code = '5020'
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO category_account_map (category_name, account_id, direction)
SELECT 'Utilities', id, 'money_out' FROM chart_of_accounts WHERE code = '5030'
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO category_account_map (category_name, account_id, direction)
SELECT 'Other', id, 'money_out' FROM chart_of_accounts WHERE code = '5090'
ON CONFLICT (category_name) DO NOTHING;

-- 5. TRANSACTIONS (user-facing simple form)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('money_in', 'money_out')),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Orange Money', 'Bank')),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(user_id, category);

-- 6. INVOICES (reserved for v2 — table only, no UI)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DEBIT = CREDIT ENFORCEMENT (the non-negotiable rule)
-- ============================================================

-- Trigger function: validate that a posted entry is balanced
CREATE OR REPLACE FUNCTION validate_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debit NUMERIC(15, 2);
  v_total_credit NUMERIC(15, 2);
  v_line_count INT;
BEGIN
  -- Only validate when status is being set to 'posted'
  IF NEW.status = 'posted' THEN
    SELECT
      COALESCE(SUM(debit_amount), 0),
      COALESCE(SUM(credit_amount), 0),
      COUNT(*)
    INTO v_total_debit, v_total_credit, v_line_count
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.id;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION 'Journal entry must have at least 2 lines before posting';
    END IF;

    IF v_total_debit != v_total_credit THEN
      RAISE EXCEPTION 'Journal entry is not balanced: debits (%) != credits (%)', v_total_debit, v_total_credit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on journal_entries: block posting unbalanced entries
DROP TRIGGER IF EXISTS trg_validate_entry_balance ON journal_entries;
CREATE TRIGGER trg_validate_entry_balance
  BEFORE UPDATE OF status ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION validate_entry_balance();

-- Trigger function: after line changes, re-validate if entry is posted
CREATE OR REPLACE FUNCTION validate_lines_on_change()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_status TEXT;
  v_total_debit NUMERIC(15, 2);
  v_total_credit NUMERIC(15, 2);
  v_entry_id UUID;
BEGIN
  -- Determine which entry was affected
  IF TG_OP = 'DELETE' THEN
    v_entry_id := OLD.journal_entry_id;
  ELSE
    v_entry_id := NEW.journal_entry_id;
  END IF;

  SELECT status INTO v_entry_status FROM journal_entries WHERE id = v_entry_id;

  IF v_entry_status = 'posted' THEN
    SELECT
      COALESCE(SUM(debit_amount), 0),
      COALESCE(SUM(credit_amount), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = v_entry_id;

    IF v_total_debit != v_total_credit THEN
      RAISE EXCEPTION 'Cannot modify lines: journal entry would become unbalanced (debits % != credits %)', v_total_debit, v_total_credit;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on journal_entry_lines: prevent breaking balance of posted entries
DROP TRIGGER IF EXISTS trg_validate_lines_on_change ON journal_entry_lines;
CREATE TRIGGER trg_validate_lines_on_change
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION validate_lines_on_change();

-- ============================================================
-- RPC: create_transaction_with_entry
-- Creates a balanced journal entry + transaction row atomically
-- ============================================================

CREATE OR REPLACE FUNCTION create_transaction_with_entry(
  p_user_id UUID,
  p_date DATE,
  p_amount NUMERIC,
  p_direction TEXT,
  p_description TEXT,
  p_category TEXT,
  p_payment_method TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id UUID;
  v_cash_account_id UUID;
  v_bank_account_id UUID;
  v_category_account_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Look up payment method account
  IF p_payment_method = 'Cash' THEN
    SELECT id INTO v_payment_account_id FROM chart_of_accounts WHERE code = '1000';
  ELSE
    SELECT id INTO v_payment_account_id FROM chart_of_accounts WHERE code = '1010';
  END IF;

  -- Look up category account
  SELECT account_id INTO v_category_account_id
  FROM category_account_map
  WHERE category_name = p_category AND direction = p_direction;

  IF v_category_account_id IS NULL THEN
    RAISE EXCEPTION 'No account mapping found for category "%" with direction "%"', p_category, p_direction;
  END IF;

  -- Create journal entry header
  INSERT INTO journal_entries (entry_date, description, source_type, status, user_id, created_by)
  VALUES (p_date, p_description, 'transaction_form', 'posted', p_user_id, p_user_id)
  RETURNING id INTO v_entry_id;

  -- Create balanced lines
  IF p_direction = 'money_in' THEN
    -- Debit Cash/Bank, Credit Revenue
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount)
    VALUES
      (v_entry_id, v_payment_account_id, p_amount, 0),
      (v_entry_id, v_category_account_id, 0, p_amount);
  ELSE
    -- Debit Expense, Credit Cash/Bank
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount)
    VALUES
      (v_entry_id, v_category_account_id, p_amount, 0),
      (v_entry_id, v_payment_account_id, 0, p_amount);
  END IF;

  -- Create the user-facing transaction row
  INSERT INTO transactions (user_id, date, amount, direction, description, category, payment_method, journal_entry_id)
  VALUES (p_user_id, p_date, p_amount, p_direction, p_description, p_category, p_payment_method, v_entry_id);

  RETURN v_entry_id;
END;
$$;

-- ============================================================
-- RLS: DISABLED during dev (re-enabled in Phase 6)
-- ============================================================
-- Intentionally not enabling RLS in this migration.
-- Phase 6 will add: ENABLE ROW LEVEL SECURITY + policies.
