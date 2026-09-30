-- ============================================================
-- Phase 6: Enable RLS + Auth
-- Security gate — must run before deploy
-- ============================================================

-- Enable RLS on all data tables
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- chart_of_accounts and category_account_map are seed data:
-- readable by all authenticated users, writable by no one (service role only)
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_account_map ENABLE ROW LEVEL SECURITY;

-- Policies for chart_of_accounts
CREATE POLICY "chart_of_accounts_select_authenticated"
  ON chart_of_accounts FOR SELECT
  TO authenticated
  USING (true);

-- Policies for category_account_map
CREATE POLICY "category_account_map_select_authenticated"
  ON category_account_map FOR SELECT
  TO authenticated
  USING (true);

-- Policies for journal_entries
CREATE POLICY "journal_entries_select_own"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "journal_entries_insert_own"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "journal_entries_update_own"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policies for journal_entry_lines (via parent journal_entries)
CREATE POLICY "journal_entry_lines_select_own"
  ON journal_entry_lines FOR SELECT
  TO authenticated
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "journal_entry_lines_insert_own"
  ON journal_entry_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "journal_entry_lines_update_own"
  ON journal_entry_lines FOR UPDATE
  TO authenticated
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "journal_entry_lines_delete_own"
  ON journal_entry_lines FOR DELETE
  TO authenticated
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE user_id = auth.uid()
    )
  );

-- Policies for transactions
CREATE POLICY "transactions_select_own"
  ON transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "transactions_insert_own"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "transactions_update_own"
  ON transactions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "transactions_delete_own"
  ON transactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Policies for invoices
CREATE POLICY "invoices_select_own"
  ON invoices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "invoices_insert_own"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "invoices_update_own"
  ON invoices FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "invoices_delete_own"
  ON invoices FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Update the RPC to use auth.uid() instead of requiring p_user_id
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id UUID;
  v_cash_account_id UUID;
  v_bank_account_id UUID;
  v_category_account_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Verify the caller owns this user_id
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: cannot create transactions for another user';
  END IF;

  IF p_payment_method = 'Cash' THEN
    SELECT id INTO v_payment_account_id FROM chart_of_accounts WHERE code = '1000';
  ELSE
    SELECT id INTO v_payment_account_id FROM chart_of_accounts WHERE code = '1010';
  END IF;

  SELECT account_id INTO v_category_account_id
  FROM category_account_map
  WHERE category_name = p_category AND direction = p_direction;

  IF v_category_account_id IS NULL THEN
    RAISE EXCEPTION 'No account mapping found for category "%" with direction "%"', p_category, p_direction;
  END IF;

  INSERT INTO journal_entries (entry_date, description, source_type, status, user_id, created_by)
  VALUES (p_date, p_description, 'transaction_form', 'posted', p_user_id, p_user_id)
  RETURNING id INTO v_entry_id;

  IF p_direction = 'money_in' THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount)
    VALUES
      (v_entry_id, v_payment_account_id, p_amount, 0),
      (v_entry_id, v_category_account_id, 0, p_amount);
  ELSE
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount)
    VALUES
      (v_entry_id, v_category_account_id, p_amount, 0),
      (v_entry_id, v_payment_account_id, 0, p_amount);
  END IF;

  INSERT INTO transactions (user_id, date, amount, direction, description, category, payment_method, journal_entry_id)
  VALUES (p_user_id, p_date, p_amount, p_direction, p_description, p_category, p_payment_method, v_entry_id);

  RETURN v_entry_id;
END;
$$;
