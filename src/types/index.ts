// ─────────────────────────────────────────
// Core domain types
// ─────────────────────────────────────────

export type TransactionType = 'income' | 'expense';
export type RecurringCategory = 'rent' | 'utilities' | 'subscription' | 'debt' | 'insurance' | 'transport' | 'other';
export type DebtPriority = 'overdue' | 'critical' | 'urgent' | 'on_track' | 'no_date';

export interface Debt {
  id:           string;
  name:         string;        // what the debt is for
  lender:       string;        // who you owe it to
  totalAmount:  number;        // original/total amount owed
  amountPaid:   number;        // how much has been paid so far
  dueDate:      string | null; // ISO date string (YYYY-MM-DD)
  interestRate: number | null; // optional annual % rate
  notes:        string | null;
  createdAt:    string;        // ISO date string
}
export type RecurringFrequency = 'monthly' | 'weekly' | 'yearly';

export interface RecurringExpense {
  id:               string;
  name:             string;
  amount:           number;
  category:         RecurringCategory;
  frequency:        RecurringFrequency;
  deductFromIncome: boolean;
}
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'ewallet' | 'other';
export type BudgetPeriod = 'monthly' | 'weekly' | 'yearly';
export type GroupRole = 'admin' | 'member';
export type CategoryType = 'expense' | 'income' | 'both';

export interface Profile {
  id:         string;
  full_name:  string | null;
  avatar_url: string | null;
  currency:   string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id:         string;
  user_id:    string | null; // null = system default
  name:       string;
  icon:       string;
  color:      string;
  type:       CategoryType;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface Transaction {
  id:             string;
  user_id:        string;
  group_id:       string | null;
  category_id:    string | null;
  type:           TransactionType;
  amount:         number;
  note:           string | null;
  date:           string; // ISO date string
  payment_method: PaymentMethod | null;
  tags:           string[];
  is_recurring:   boolean;
  created_at:     string;
  updated_at:     string;
  // Joined
  category?:      Category;
}

export interface Budget {
  id:          string;
  user_id:     string | null;
  group_id:    string | null;
  category_id: string;
  amount:      number;
  period:      BudgetPeriod;
  month:       number | null;
  year:        number | null;
  created_at:  string;
  updated_at:  string;
  // Joined
  category?:   Category;
  // Computed
  spent?:      number;
}

export interface SavingsGoal {
  id:             string;
  user_id:        string | null;
  group_id:       string | null;
  name:           string;
  icon:           string;
  color:          string;
  target_amount:  number;
  current_amount: number;
  deadline:       string | null;
  is_completed:   boolean;
  created_at:     string;
  updated_at:     string;
}

export interface FamilyGroup {
  id:          string;
  name:        string;
  description: string | null;
  icon:        string;
  color:       string;
  created_by:  string;
  invite_code: string;
  created_at:  string;
  updated_at:  string;
  // Joined
  members?:    GroupMember[];
}

export interface GroupMember {
  id:        string;
  group_id:  string;
  user_id:   string;
  role:      GroupRole;
  joined_at: string;
  // Joined
  profile?:  Profile;
}

// ─────────────────────────────────────────
// UI / App types
// ─────────────────────────────────────────

export interface Insight {
  id:      string;
  type:    'positive' | 'warning' | 'neutral';
  title:   string;
  message: string;
  icon:    string;
}

// ── Smart Notification System ─────────────────────────────────────────────────

export type InsightCategory = 'awareness' | 'budget' | 'protection' | 'motivation' | 'neutral';
export type InsightSeverity = 'info' | 'warning' | 'success' | 'alert';

export interface SmartInsight {
  id:           string;
  category:     InsightCategory;
  severity:     InsightSeverity;
  icon:         string;
  title:        string;
  message:      string;
  actionLabel?: string;
  actionRoute?: string;
  createdAt:    number;
  dismissed:    boolean;
}

export interface NotificationPrefs {
  financialAwareness: {
    enabled:                boolean;
    spendingHabits:         boolean;
    unusualSpending:        boolean;
    largePurchase:          boolean;
    largePurchaseThreshold: number;   // default 200
  };
  budgetControl: {
    enabled:        boolean;
    warningAt:      number;           // % threshold, default 80
    categoryAlerts: boolean;
  };
  accountProtection: {
    enabled:              boolean;
    lowBalance:           boolean;
    lowBalanceThreshold:  number;     // default 100
    overdraftRisk:        boolean;
    billReminders:        boolean;
  };
  motivation: {
    enabled:            boolean;
    goalProgress:       boolean;
    monthlyComparison:  boolean;
    positiveReinforcement: boolean;
  };
  pushEnabled: boolean;
}

export interface WalletContext {
  type:     'personal' | 'group';
  groupId?: string;
  name:     string;
}

export interface MonthlyStats {
  totalIncome:   number;
  totalExpenses: number;
  balance:       number;
  savingsRate:   number;
  byCategory:    { category: Category; amount: number; percentage: number }[];
}

// Form types
export interface NewTransactionForm {
  type:           TransactionType;
  amount:         string;
  category_id:    string;
  note:           string;
  date:           Date;
  payment_method: PaymentMethod | null;
  tags:           string[];
  group_id:       string | null;
}

export interface NewBudgetForm {
  category_id: string;
  amount:      string;
  period:      BudgetPeriod;
  month:       number;
  year:        number;
  group_id:    string | null;
}

export interface NewGoalForm {
  name:          string;
  icon:          string;
  color:         string;
  target_amount: string;
  deadline:      Date | null;
  group_id:      string | null;
}
