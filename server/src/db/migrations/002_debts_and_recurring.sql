-- ============================================================
-- Budget App — Migration 002: Debts & Recurring Expenses
-- ============================================================

-- ─────────────────────────────────────────
-- DEBTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  lender        TEXT NOT NULL,
  total_amount  NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  amount_paid   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_date      DATE,
  interest_rate NUMERIC(5,2) CHECK (interest_rate IS NULL OR interest_rate >= 0),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debts_user ON debts (user_id);
CREATE INDEX IF NOT EXISTS idx_debts_due  ON debts (user_id, due_date);

-- ─────────────────────────────────────────
-- RECURRING EXPENSES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  category            TEXT NOT NULL CHECK (category IN ('rent', 'utilities', 'subscription', 'debt', 'insurance', 'transport', 'other')) DEFAULT 'other',
  frequency           TEXT NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'yearly')) DEFAULT 'monthly',
  deduct_from_income  BOOLEAN NOT NULL DEFAULT FALSE,
  next_due_date       DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_expenses (user_id);

-- ─────────────────────────────────────────
-- TRIGGERS — auto-update updated_at
-- ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_debts_updated_at              ON debts;
DROP TRIGGER IF EXISTS trg_recurring_expenses_updated_at ON recurring_expenses;

CREATE TRIGGER trg_debts_updated_at
  BEFORE UPDATE ON debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_recurring_expenses_updated_at
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
