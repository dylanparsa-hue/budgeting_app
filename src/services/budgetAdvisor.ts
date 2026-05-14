/**
 * budgetAdvisor.ts
 *
 * AI-powered budget recommendation engine.
 * Analyses income, spending history, recurring bills, and savings goals
 * to produce a personalised monthly budget plan — no LLM required.
 *
 * Algorithm: hybrid 50/30/20 baseline + weighted personal-history blending.
 */

import { Transaction } from '../types';
import { getBudgetMonthKey } from '../utils/budgetMonth';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecStatus = 'excellent' | 'good' | 'warning' | 'over';
export type Priority  = 'essential' | 'lifestyle' | 'savings';

export interface BudgetRecommendation {
  id:                string;
  categoryKey:       string;
  categoryName:      string;
  icon:              string;
  color:             string;
  recommendedAmount: number;
  currentSpend:      number;
  percentOfIncome:   number;
  reason:            string;
  tip:               string;
  priority:          Priority;
  status:            RecStatus;
}

export interface BudgetPlan {
  monthlyIncome:    number;
  totalRecommended: number;
  savingsTarget:    number;
  essentialsTotal:  number;
  lifestyleTotal:   number;
  recommendations:  BudgetRecommendation[];
  summary:          string;
  coachMessage:     string;
  healthScore:      number;   // 0–100
  lastUpdated:      Date;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

export function toMonthly(amount: number, freq: string): number {
  if (freq === 'weekly') return (amount * 52) / 12;
  if (freq === 'yearly') return amount / 12;
  return amount;
}

interface CatConfig {
  name:      string;
  icon:      string;
  color:     string;
  targetPct: number;          // % of disposable income (or gross for savings)
  priority:  Priority;
  keys:      string[];        // partial-match against category name (lowercase)
}

const CATEGORY_CONFIG: Record<string, CatConfig> = {
  food: {
    name: 'Food & Dining',  icon: '🍽️', color: '#F97316',
    targetPct: 18, priority: 'essential',
    keys: ['food', 'dining', 'restaurant', 'groceries', 'meal', 'cafe', 'coffee'],
  },
  transport: {
    name: 'Transport',       icon: '🚌', color: '#3B82F6',
    targetPct: 10, priority: 'essential',
    keys: ['transport', 'car', 'fuel', 'petrol', 'grab', 'commute', 'bus', 'train'],
  },
  health: {
    name: 'Health',          icon: '❤️', color: '#EF4444',
    targetPct: 5,  priority: 'essential',
    keys: ['health', 'medical', 'pharmacy', 'gym', 'fitness', 'doctor', 'clinic'],
  },
  bills: {
    name: 'Bills & Utilities', icon: '⚡', color: '#F59E0B',
    targetPct: 8,  priority: 'essential',
    keys: ['bill', 'utilities', 'electricity', 'water', 'internet', 'phone', 'telco'],
  },
  shopping: {
    name: 'Shopping',        icon: '🛍️', color: '#8B5CF6',
    targetPct: 10, priority: 'lifestyle',
    keys: ['shopping', 'clothing', 'fashion', 'retail', 'clothes', 'apparel'],
  },
  entertainment: {
    name: 'Entertainment',   icon: '🎬', color: '#EC4899',
    targetPct: 5,  priority: 'lifestyle',
    keys: ['entertainment', 'movies', 'games', 'hobbies', 'subscription', 'streaming'],
  },
  education: {
    name: 'Education',       icon: '📚', color: '#059669',
    targetPct: 5,  priority: 'lifestyle',
    keys: ['education', 'books', 'courses', 'learning', 'school', 'tuition'],
  },
  savings: {
    name: 'Savings & Goals', icon: '💰', color: '#9FE870',
    targetPct: 20, priority: 'savings',
    keys: ['savings', 'investment', 'goals', 'saving'],
  },
  others: {
    name: 'Everything Else', icon: '📦', color: '#6B7280',
    targetPct: 7,  priority: 'lifestyle',
    keys: ['others', 'other', 'miscellaneous', 'general'],
  },
};

function matchCategoryKey(catName: string): string {
  const lower = catName.toLowerCase();
  for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
    if (cfg.keys.some(k => lower.includes(k))) return key;
  }
  return 'others';
}

function getStatusAndTip(
  recommended: number,
  actual:      number,
  catKey:      string,
): { status: RecStatus; tip: string } {
  if (actual === 0) {
    return { status: 'good', tip: 'No spending recorded here yet this month.' };
  }
  const ratio = actual / Math.max(recommended, 1);
  const name  = CATEGORY_CONFIG[catKey]?.name ?? catKey;

  if (ratio <= 0.70) return { status: 'excellent', tip: `Well under budget — great financial discipline!` };
  if (ratio <= 1.00) return { status: 'good',      tip: `On track — ${Math.round((1 - ratio) * 100)}% of budget remaining.` };
  if (ratio <= 1.30) return { status: 'warning',   tip: `Slightly over. Consider pausing extra ${(CATEGORY_CONFIG[catKey]?.name ?? name).toLowerCase()} spending.` };
  return               { status: 'over',      tip: `Significantly over budget. Review your recent ${(CATEGORY_CONFIG[catKey]?.name ?? name).toLowerCase()} transactions.` };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateBudgetPlan({
  transactions,
  recurring,
  goals,
  categories,
  savingsOverridePct,
}: {
  transactions:       Transaction[];
  recurring:          { amount: number; frequency: string }[];
  goals:              { target_amount: number; current_amount: number; is_completed?: boolean }[];
  categories:         { id: string; name: string; color?: string | null }[];
  savingsOverridePct?: number;   // user-chosen savings %, overrides auto calculation
}): BudgetPlan {
  const now      = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();

  // ── 1. Average monthly income (last 3 months) ────────────────────────────
  const lookback = [0, 1, 2].map(i => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  let totalIncome   = 0;
  let incomeMonths  = 0;
  for (const { month, year } of lookback) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    // Use budget month (via tag) not transaction date so early-received income
    // counts toward the month the user assigned it to.
    const mi = transactions
      .filter(t => t.type === 'income' && getBudgetMonthKey(t) === monthKey)
      .reduce((s, t) => s + t.amount, 0);
    if (mi > 0) { totalIncome += mi; incomeMonths++; }
  }
  const monthlyIncome = incomeMonths > 0 ? totalIncome / incomeMonths : 0;

  // ── 2. Fixed recurring obligations ───────────────────────────────────────
  const billsTotal  = recurring.reduce((s, r) => s + toMonthly(r.amount, r.frequency), 0);
  const disposable  = Math.max(monthlyIncome - billsTotal, 0);

  // ── 3. Current-month spending by config key (exclude recurring/fixed-bill transactions
  //       — those are already accounted for in billsTotal above) ───────────────
  const curSpendByKey = new Map<string, number>();
  transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && !t.is_recurring &&
             d.getMonth() + 1 === curMonth && d.getFullYear() === curYear;
    })
    .forEach(t => {
      const cat = categories.find(c => c.id === t.category_id);
      const key = cat ? matchCategoryKey(cat.name) : 'others';
      curSpendByKey.set(key, (curSpendByKey.get(key) ?? 0) + t.amount);
    });

  // ── 4. 3-month average spend per key (non-recurring only) ─────────────────
  const avgSpendByKey = new Map<string, number>();
  for (const { month, year } of lookback) {
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && !t.is_recurring &&
               d.getMonth() + 1 === month && d.getFullYear() === year;
      })
      .forEach(t => {
        const cat = categories.find(c => c.id === t.category_id);
        const key = cat ? matchCategoryKey(cat.name) : 'others';
        avgSpendByKey.set(key, (avgSpendByKey.get(key) ?? 0) + t.amount);
      });
  }
  for (const [key, total] of avgSpendByKey.entries()) {
    avgSpendByKey.set(key, total / Math.max(incomeMonths, 1));
  }

  // ── 5. Goals factor + savings % ──────────────────────────────────────────
  const activeGoals = goals.filter(g => !g.is_completed && g.current_amount < g.target_amount);
  const hasGoals    = activeGoals.length > 0;

  // User-chosen % takes priority; otherwise auto-boost for active goals
  const savingsPct = savingsOverridePct != null
    ? savingsOverridePct
    : hasGoals
      ? Math.min(30, CATEGORY_CONFIG.savings.targetPct + activeGoals.length * 2)
      : CATEGORY_CONFIG.savings.targetPct;

  // ── 6. Build recommendations (pure income-based — no history blending) ───
  const recommendations: BudgetRecommendation[] = [];

  for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
    const pct  = key === 'savings' ? savingsPct : cfg.targetPct;
    const base = key === 'savings' ? monthlyIncome : disposable;

    // Pure rule-based: recommended is fixed to income %, never shifts with spending
    const recommended = Math.round((pct / 100) * base);

    const currentSpend = curSpendByKey.get(key) ?? 0;
    const avg          = avgSpendByKey.get(key) ?? 0;
    const { status, tip } = getStatusAndTip(recommended, currentSpend, key);

    // Human-readable reason — historical avg shown as context only, never changes the target
    let reason = '';
    if (monthlyIncome === 0) {
      reason = 'Log your income to get personalised recommendations.';
    } else if (key === 'savings') {
      if (savingsOverridePct != null) {
        reason = `${savingsPct}% of income — your chosen savings target`;
      } else if (hasGoals) {
        reason = `${savingsPct}% of income — boosted for your ${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''}`;
      } else {
        reason = `${savingsPct}% of income — standard 50/30/20 savings target`;
      }
    } else if (avg > 0) {
      const pctOfInc = Math.round((recommended / monthlyIncome) * 100);
      const diff = Math.round(((avg - recommended) / Math.max(recommended, 1)) * 100);
      if (diff > 20) {
        reason = `${pctOfInc}% of income — you usually spend ~${compact(avg)} (${diff}% over target)`;
      } else if (diff < -10) {
        reason = `${pctOfInc}% of income — you usually spend ~${compact(avg)} (well under)`;
      } else {
        reason = `${pctOfInc}% of income — close to your usual ~${compact(avg)}`;
      }
    } else {
      const pctOfInc = Math.round((recommended / monthlyIncome) * 100);
      reason = `${pctOfInc}% of income — standard allocation`;
    }

    recommendations.push({
      id:                key,
      categoryKey:       key,
      categoryName:      cfg.name,
      icon:              cfg.icon,
      color:             cfg.color,
      recommendedAmount: recommended,
      currentSpend,
      percentOfIncome:   monthlyIncome > 0 ? Math.round((recommended / monthlyIncome) * 100) : 0,
      reason,
      tip,
      priority:          cfg.priority,
      status,
    });
  }

  // Sort: savings first → essential → lifestyle
  recommendations.sort((a, b) => {
    const order: Record<Priority, number> = { savings: 0, essential: 1, lifestyle: 2 };
    return order[a.priority] - order[b.priority];
  });

  // ── 7. Totals ─────────────────────────────────────────────────────────────
  const savingsTarget   = recommendations.find(r => r.categoryKey === 'savings')?.recommendedAmount ?? 0;
  const essentialsTotal = recommendations.filter(r => r.priority === 'essential').reduce((s, r) => s + r.recommendedAmount, 0);
  const lifestyleTotal  = recommendations.filter(r => r.priority === 'lifestyle').reduce((s, r) => s + r.recommendedAmount, 0);
  const totalRecommended = essentialsTotal + lifestyleTotal + savingsTarget + billsTotal;

  // ── 8. Health score ───────────────────────────────────────────────────────
  const overCount      = recommendations.filter(r => r.status === 'over').length;
  const warnCount      = recommendations.filter(r => r.status === 'warning').length;
  const excellentCount = recommendations.filter(r => r.status === 'excellent').length;
  const healthScore    = Math.max(0, Math.min(100,
    100 - overCount * 20 - warnCount * 8 + excellentCount * 4
  ));

  // ── 9. Coach message ──────────────────────────────────────────────────────
  let summary      = '';
  let coachMessage = '';

  if (monthlyIncome === 0) {
    summary      = 'Record your income to unlock AI budget recommendations.';
    coachMessage = "Once I know your monthly income, I'll build a personalised budget plan around your habits and goals.";
  } else if (healthScore >= 80) {
    summary      = `Looking great — aiming for ${compact(savingsTarget)} in savings this month.`;
    coachMessage = `Your spending is well-balanced. Keep ${compact(savingsTarget)} aside for savings and you'll be in excellent shape.`;
  } else if (healthScore >= 55) {
    const topOver = recommendations.find(r => r.status === 'over' || r.status === 'warning');
    summary      = `A few tweaks needed — focus on ${topOver?.categoryName ?? 'a couple of categories'}.`;
    coachMessage = `You're on a reasonable track. Tightening up on ${topOver?.categoryName ?? 'your top categories'} could free up an extra ${compact(Math.max(0, (topOver?.currentSpend ?? 0) - (topOver?.recommendedAmount ?? 0)))} this month.`;
  } else {
    summary      = "Let's reset your spending plan for the month.";
    coachMessage = `You've exceeded budget in ${overCount} ${overCount === 1 ? 'category' : 'categories'}. Start with the red items below — small reductions add up quickly.`;
  }

  return {
    monthlyIncome,
    totalRecommended,
    savingsTarget,
    essentialsTotal,
    lifestyleTotal,
    recommendations,
    summary,
    coachMessage,
    healthScore,
    lastUpdated: now,
  };
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}
