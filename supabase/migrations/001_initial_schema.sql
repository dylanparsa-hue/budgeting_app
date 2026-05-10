-- ============================================================
-- Budget App — Initial Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- PROFILES  (extends Supabase auth.users)
-- ─────────────────────────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  avatar_url    TEXT,
  currency      TEXT NOT NULL DEFAULT 'MYR',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = system default
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '💰',
  color       TEXT NOT NULL DEFAULT '#6366F1',
  type        TEXT NOT NULL CHECK (type IN ('expense', 'income', 'both')) DEFAULT 'expense',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default categories (system-level, user_id = NULL)
INSERT INTO categories (name, icon, color, type, is_default, sort_order) VALUES
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
  ('Gift',          '🎁', '#F43F5E', 'income',  TRUE, 12);

-- ─────────────────────────────────────────
-- FAMILY GROUPS
-- ─────────────────────────────────────────
CREATE TABLE family_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  icon         TEXT NOT NULL DEFAULT '👨‍👩‍👧‍👦',
  color        TEXT NOT NULL DEFAULT '#6366F1',
  created_by   UUID NOT NULL REFERENCES profiles(id),
  invite_code  TEXT UNIQUE DEFAULT UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- GROUP MEMBERS
-- ─────────────────────────────────────────
CREATE TABLE group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- ─────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────
CREATE TABLE transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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

CREATE INDEX idx_transactions_user_date  ON transactions (user_id, date DESC);
CREATE INDEX idx_transactions_group_date ON transactions (group_id, date DESC);
CREATE INDEX idx_transactions_category   ON transactions (category_id);

-- ─────────────────────────────────────────
-- BUDGETS
-- ─────────────────────────────────────────
CREATE TABLE budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id     UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  period       TEXT NOT NULL CHECK (period IN ('monthly', 'weekly', 'yearly')) DEFAULT 'monthly',
  month        SMALLINT CHECK (month BETWEEN 1 AND 12),
  year         SMALLINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Either personal OR group, not both
  CHECK ((user_id IS NOT NULL) != (group_id IS NOT NULL)),
  UNIQUE (user_id, category_id, period, month, year),
  UNIQUE (group_id, category_id, period, month, year)
);

-- ─────────────────────────────────────────
-- SAVINGS GOALS
-- ─────────────────────────────────────────
CREATE TABLE savings_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
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
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals  ENABLE ROW LEVEL SECURITY;

-- Profiles: only own row
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Categories: own + system defaults
CREATE POLICY "categories_read" ON categories
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "categories_write" ON categories
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_update" ON categories
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "categories_delete" ON categories
  FOR DELETE USING (user_id = auth.uid());

-- Family groups: members can view
CREATE POLICY "groups_member_select" ON family_groups
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "groups_creator_write" ON family_groups
  FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "groups_creator_update" ON family_groups
  FOR UPDATE USING (created_by = auth.uid());

-- Group members
CREATE POLICY "members_select" ON group_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "members_insert" ON group_members
  FOR INSERT WITH CHECK (
    group_id IN (SELECT id FROM family_groups WHERE created_by = auth.uid())
    OR user_id = auth.uid()  -- joining via invite code
  );
CREATE POLICY "members_delete" ON group_members
  FOR DELETE USING (user_id = auth.uid());

-- Transactions: own + group member
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (
    user_id = auth.uid() OR
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND (
      group_id IS NULL OR
      group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "transactions_update" ON transactions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "transactions_delete" ON transactions
  FOR DELETE USING (user_id = auth.uid());

-- Budgets
CREATE POLICY "budgets_select" ON budgets
  FOR SELECT USING (
    user_id = auth.uid() OR
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "budgets_write" ON budgets
  FOR ALL USING (
    user_id = auth.uid() OR
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Savings goals
CREATE POLICY "goals_select" ON savings_goals
  FOR SELECT USING (
    user_id = auth.uid() OR
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "goals_write" ON savings_goals
  FOR ALL USING (user_id = auth.uid());

-- ─────────────────────────────────────────
-- REALTIME (for family group sync)
-- ─────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE savings_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
