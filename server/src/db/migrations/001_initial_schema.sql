-- ============================================================
-- Budget App — Initial Schema (Self-hosted PostgreSQL)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- USERS  (replaces Supabase auth.users + profiles)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  currency      TEXT NOT NULL DEFAULT 'MYR',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ─────────────────────────────────────────
-- REFRESH TOKENS  (for JWT rotation)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry ON refresh_tokens (expires_at);

-- ─────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = system default
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '💰',
  color       TEXT NOT NULL DEFAULT '#6366F1',
  type        TEXT NOT NULL CHECK (type IN ('expense', 'income', 'both')) DEFAULT 'expense',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default categories (system-level, user_id = NULL)
INSERT INTO categories (name, icon, color, type, is_default, sort_order)
SELECT * FROM (VALUES
  ('Food',          '🍔', '#F97316', 'expense', TRUE, 1),
  ('Transport',     '🚗', '#3B82F6', 'expense', TRUE, 2),
  ('Bills',         '⚡', '#EAB308', 'expense', TRUE, 3),
  ('Shopping',      '🛍️', '#EC4899', 'expense', TRUE, 4),
  ('Entertainment', '🎮', '#8B5CF6', 'expense', TRUE, 5),
  ('Health',        '❤️', '#EF4444', 'expense', TRUE, 6),
  ('Education',     '📚', '#06B6D4', 'expense', TRUE, 7),
  ('Others',        '📦', '#6B7280', 'expense', TRUE, 8),
  ('Salary',        '💼', '#10B981', 'income',  TRUE, 9),
  ('Freelance',     '💻', '#6366F1', 'income',  TRUE, 10),
  ('Investment',    '📈', '#059669', 'income',  TRUE, 11),
  ('Gift',          '🎁', '#F43F5E', 'income',  TRUE, 12)
) AS v(name, icon, color, type, is_default, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL LIMIT 1);

-- ─────────────────────────────────────────
-- FAMILY GROUPS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  icon         TEXT NOT NULL DEFAULT '👨‍👩‍👧‍👦',
  color        TEXT NOT NULL DEFAULT '#6366F1',
  created_by   UUID NOT NULL REFERENCES users(id),
  invite_code  TEXT UNIQUE DEFAULT UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- GROUP MEMBERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- ─────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id       UUID REFERENCES family_groups(id) ON DELETE SET NULL,
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note           TEXT,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'ewallet', 'other')),
  tags           TEXT[] DEFAULT '{}',
  is_recurring   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date  ON transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_group_date ON transactions (group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category   ON transactions (category_id);

-- ─────────────────────────────────────────
-- BUDGETS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id     UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  period       TEXT NOT NULL CHECK (period IN ('monthly', 'weekly', 'yearly')) DEFAULT 'monthly',
  month        SMALLINT CHECK (month BETWEEN 1 AND 12),
  year         SMALLINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((user_id IS NOT NULL) != (group_id IS NOT NULL)),
  UNIQUE (user_id, category_id, period, month, year),
  UNIQUE (group_id, category_id, period, month, year)
);

-- ─────────────────────────────────────────
-- SAVINGS GOALS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  icon            TEXT NOT NULL DEFAULT '🎯',
  color           TEXT NOT NULL DEFAULT '#6366F1',
  target_amount   NUMERIC(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline        DATE,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((user_id IS NOT NULL) != (group_id IS NOT NULL))
);

-- ─────────────────────────────────────────
-- FUNCTION: join_group_by_invite_code
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION join_group_by_invite_code(
  p_invite_code TEXT,
  p_user_id     UUID
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id
  FROM family_groups
  WHERE invite_code = UPPER(p_invite_code);

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO group_members (group_id, user_id, role)
  VALUES (v_group_id, p_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN v_group_id;
END;
$$;

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at TRIGGER FUNCTION
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────
-- TRIGGERS (idempotent: drop first)
-- CREATE OR REPLACE TRIGGER requires PG ≥ 14.
-- DROP IF EXISTS + CREATE works on PG 12+.
-- ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_users_updated_at        ON users;
DROP TRIGGER IF EXISTS trg_transactions_updated_at  ON transactions;
DROP TRIGGER IF EXISTS trg_budgets_updated_at       ON budgets;
DROP TRIGGER IF EXISTS trg_savings_goals_updated_at ON savings_goals;
DROP TRIGGER IF EXISTS trg_family_groups_updated_at ON family_groups;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_savings_goals_updated_at
  BEFORE UPDATE ON savings_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_family_groups_updated_at
  BEFORE UPDATE ON family_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
