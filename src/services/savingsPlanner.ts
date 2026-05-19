/**
 * Smart Savings Planner Engine
 *
 * Calculates a personalised, conservative monthly savings plan:
 *
 *  1. Disposable income  = avg income - fixed bills - avg variable spending
 *  2. Safe savings       = disposable - safety buffer (default 20 % of income)
 *  3. Goal allocation    = deadline goals funded first (urgency order),
 *                         remaining split equally among open-ended goals
 *  4. Feasibility check  = compares allocation vs required-monthly per goal
 *  5. Income gap         = extra income needed if goals can't be funded
 *  6. Advice             = plain-English sentences the UI can render directly
 *
 * All monetary inputs / outputs use the same currency unit (no conversion).
 * Averages use the last `lookbackMonths` months (default 3) for stability.
 */

import {
  subMonths,
  startOfMonth,
  endOfMonth,
  differenceInMonths,
  isAfter,
  parseISO,
} from 'date-fns';
import { Transaction, RecurringExpense, SavingsGoal } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function toMonthly(amount: number, freq: string): number {
  if (freq === 'weekly') return (amount * 52) / 12;
  if (freq === 'yearly') return amount / 12;
  return amount;
}

/**
 * Returns the arithmetic mean of monthly totals over `lookback` past months.
 * Months with zero transactions contribute 0 (stabilises new-user values).
 */
function avgMonthly(
  transactions: Transaction[],
  type: 'income' | 'expense',
  lookback: number,
  excludeTags: string[] = [],
): number {
  const now = new Date();
  let total = 0;

  for (let i = 1; i <= lookback; i++) {
    const ref   = subMonths(now, i);
    const start = startOfMonth(ref);
    const end   = endOfMonth(ref);

    const bucket = transactions.filter(t => {
      if (t.type !== type) return false;
      if (excludeTags.some(tag => t.tags?.includes(tag))) return false;
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    total += bucket.reduce((s, t) => s + Number(t.amount), 0);
  }

  return total / lookback;
}

// Compact currency label used inside advice strings
function money(n: number, currency: string): string {
  const abs = Math.abs(n);
  const formatted = abs >= 1000
    ? `${(abs / 1000).toFixed(1)}K`
    : abs.toFixed(0);
  return `${currency} ${formatted}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type GoalStatus = 'feasible' | 'risky' | 'not_feasible';

export interface GoalPlan {
  goalId:           string;
  goalName:         string;
  goalIcon:         string;
  goalColor:        string;
  currentAmount:    number;
  targetAmount:     number;
  remainingAmount:  number;
  /** Recommended monthly allocation from safe savings */
  monthlySaving:    number;
  /** Monthly amount required to hit deadline — null if no deadline */
  requiredMonthly:  number | null;
  monthsRemaining:  number | null;
  /** Projected months to complete at recommended rate */
  projectedMonths:  number | null;
  status:           GoalStatus;
  /** Per-month gap when status is risky / not_feasible */
  shortfall:        number;
}

export interface SavingsPlanResult {
  // ── Inputs summary ──────────────────────────────────────────────────────
  monthlyIncome:        number;
  fixedExpenses:        number;
  avgVariableExpenses:  number;
  disposableIncome:     number;
  safetyBufferPct:      number;
  safetyBufferAmount:   number;
  safeSavings:          number;
  /** Actual number of months used for averaging (may be less than lookbackMonths) */
  effectiveLookback:    number;

  // ── Goal plans ───────────────────────────────────────────────────────────
  goalPlans:             GoalPlan[];
  totalRequiredSavings:  number;
  totalAllocatedSavings: number;
  incomeGap:             number;

  // ── Human-readable advice ────────────────────────────────────────────────
  advice: string[];
}

export interface PlannerInput {
  transactions:     Transaction[];
  recurringItems:   RecurringExpense[];
  goals:            SavingsGoal[];
  /** Safety buffer as a fraction of income. Default: 0.20 (20 %) */
  safetyBufferPct?: number;
  /** How many past months to average. Default: 3 */
  lookbackMonths?:  number;
  /** ISO date string (YYYY-MM-DD) — first month the user started tracking.
   *  Lookback will not go further back than this date. */
  trackingStartDate?: string | null;
  currency:         string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function generateSavingsPlan(input: PlannerInput): SavingsPlanResult {
  const {
    transactions,
    recurringItems,
    goals,
    safetyBufferPct    = 0.20,
    lookbackMonths     = 3,
    trackingStartDate,
    currency,
  } = input;

  // Clamp lookback to months elapsed since the user started tracking.
  // This prevents early months (with no data) from dragging averages to zero.
  const effectiveLookback = (() => {
    if (!trackingStartDate) return lookbackMonths;
    const startDate    = parseISO(trackingStartDate);
    const now          = new Date();
    // How many complete past months exist since start?
    // differenceInMonths gives whole months; we want months 1…N in the past.
    const monthsSince  = differenceInMonths(now, startOfMonth(startDate));
    // At least 1 month, at most the configured lookback
    return Math.min(lookbackMonths, Math.max(1, monthsSince));
  })();

  // ── Step 1: Income & expense averages ─────────────────────────────────────
  const monthlyIncome       = avgMonthly(transactions, 'income',  effectiveLookback);
  // Exclude savings-tagged transactions so they don't inflate variable spend
  const avgVariableExpenses = avgMonthly(transactions, 'expense', effectiveLookback, ['savings']);
  const fixedExpenses       = recurringItems.reduce(
    (s, i) => s + toMonthly(i.amount, i.frequency), 0,
  );

  // ── Step 2: Disposable income & safe savings ──────────────────────────────
  const disposableIncome   = monthlyIncome - fixedExpenses - avgVariableExpenses;
  const safetyBufferAmount = monthlyIncome * safetyBufferPct;
  // Never negative — if we can't save, safe savings = 0
  const safeSavings        = Math.max(0, disposableIncome - safetyBufferAmount);

  // ── Step 3: Active goals ──────────────────────────────────────────────────
  const activeGoals = goals.filter(
    g => !g.is_completed && g.target_amount > g.current_amount,
  );

  if (activeGoals.length === 0) {
    const advice = buildAdvice({
      monthlyIncome, fixedExpenses, avgVariableExpenses,
      disposableIncome, safeSavings, safetyBufferPct,
      goalPlans: [], incomeGap: 0, currency,
    });
    return {
      monthlyIncome, fixedExpenses, avgVariableExpenses,
      disposableIncome, safetyBufferPct, safetyBufferAmount,
      safeSavings, effectiveLookback, goalPlans: [],
      totalRequiredSavings: 0, totalAllocatedSavings: 0,
      incomeGap: 0, advice,
    };
  }

  const now = new Date();

  // ── Step 4: Required monthly per goal ─────────────────────────────────────
  const goalMeta = activeGoals.map(goal => {
    const remaining = Math.max(0, goal.target_amount - goal.current_amount);
    let requiredMonthly: number | null = null;
    let monthsRemaining: number | null = null;

    if (goal.deadline) {
      const deadline = new Date(goal.deadline);
      if (isAfter(deadline, now)) {
        monthsRemaining = Math.max(1, differenceInMonths(deadline, now));
        requiredMonthly = remaining / monthsRemaining;
      } else {
        // Overdue — full remaining amount needed immediately
        monthsRemaining = 0;
        requiredMonthly = remaining;
      }
    }

    return { goal, remaining, requiredMonthly, monthsRemaining };
  });

  // ── Step 5: Allocate safe savings ─────────────────────────────────────────
  //   Priority: deadline goals sorted by urgency (highest required/month first)
  //   Then open-ended goals share whatever remains equally.

  const withDeadline    = goalMeta
    .filter(g => g.requiredMonthly !== null)
    .sort((a, b) => (b.requiredMonthly ?? 0) - (a.requiredMonthly ?? 0));
  const withoutDeadline = goalMeta.filter(g => g.requiredMonthly === null);

  const totalRequired = withDeadline.reduce(
    (s, g) => s + (g.requiredMonthly ?? 0), 0,
  );

  const alloc   = new Map<string, number>();
  let remaining = safeSavings;

  if (totalRequired <= safeSavings) {
    // Fully fund every deadline goal; split surplus among open-ended goals
    for (const g of withDeadline) {
      const a = Math.min(g.requiredMonthly ?? 0, remaining);
      alloc.set(g.goal.id, a);
      remaining -= a;
    }
    if (withoutDeadline.length > 0) {
      const share = remaining > 0 ? remaining / withoutDeadline.length : 0;
      for (const g of withoutDeadline) alloc.set(g.goal.id, share);
    }
  } else {
    // Can't fully fund — distribute proportionally by urgency weight
    const denominator = totalRequired > 0 ? totalRequired : 1;
    for (const g of withDeadline) {
      const share = (g.requiredMonthly ?? 0) / denominator;
      alloc.set(g.goal.id, safeSavings * share);
    }
    // Open-ended goals receive nothing when deadline goals can't be met
    for (const g of withoutDeadline) alloc.set(g.goal.id, 0);
  }

  // ── Step 6: Build GoalPlan objects ────────────────────────────────────────
  const goalPlans: GoalPlan[] = goalMeta.map(
    ({ goal, remaining: rem, requiredMonthly, monthsRemaining }) => {
      const monthlySaving = alloc.get(goal.id) ?? 0;

      let status: GoalStatus = 'feasible';
      let shortfall = 0;

      if (requiredMonthly !== null && requiredMonthly > 0) {
        if (monthlySaving >= requiredMonthly * 0.99) {
          status = 'feasible';
        } else if (monthlySaving >= requiredMonthly * 0.70) {
          status    = 'risky';
          shortfall = requiredMonthly - monthlySaving;
        } else {
          status    = 'not_feasible';
          shortfall = requiredMonthly - monthlySaving;
        }
      } else {
        // No deadline — feasible as long as something is allocated
        status = monthlySaving > 0 ? 'feasible' : 'risky';
      }

      const projectedMonths =
        monthlySaving > 0 ? Math.ceil(rem / monthlySaving) : null;

      return {
        goalId:          goal.id,
        goalName:        goal.name,
        goalIcon:        goal.icon,
        goalColor:       goal.color,
        currentAmount:   goal.current_amount,
        targetAmount:    goal.target_amount,
        remainingAmount: rem,
        monthlySaving,
        requiredMonthly,
        monthsRemaining,
        projectedMonths,
        status,
        shortfall,
      };
    },
  );

  const totalAllocatedSavings = goalPlans.reduce(
    (s, g) => s + g.monthlySaving, 0,
  );
  const incomeGap = Math.max(0, totalRequired - safeSavings);

  const advice = buildAdvice({
    monthlyIncome, fixedExpenses, avgVariableExpenses,
    disposableIncome, safeSavings, safetyBufferPct,
    goalPlans, incomeGap, currency,
  });

  return {
    monthlyIncome, fixedExpenses, avgVariableExpenses,
    disposableIncome, safetyBufferPct, safetyBufferAmount,
    safeSavings, effectiveLookback, goalPlans,
    totalRequiredSavings: totalRequired,
    totalAllocatedSavings,
    incomeGap, advice,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Advice builder
// ─────────────────────────────────────────────────────────────────────────────

function buildAdvice(p: {
  monthlyIncome:       number;
  fixedExpenses:       number;
  avgVariableExpenses: number;
  disposableIncome:    number;
  safeSavings:         number;
  safetyBufferPct:     number;
  goalPlans:           GoalPlan[];
  incomeGap:           number;
  currency:            string;
}): string[] {
  const {
    monthlyIncome, fixedExpenses, avgVariableExpenses,
    disposableIncome, safeSavings, safetyBufferPct,
    goalPlans, incomeGap, currency,
  } = p;

  const out: string[] = [];

  // ── No income recorded ────────────────────────────────────────────────────
  if (monthlyIncome === 0) {
    out.push('No income found in recent months. Add income transactions so we can calculate your savings capacity.');
    return out;
  }

  const totalOut = fixedExpenses + avgVariableExpenses;
  const fixedPct = fixedExpenses  / monthlyIncome;
  const savePct  = safeSavings    / monthlyIncome;

  // ── Critical: spending exceeds income ─────────────────────────────────────
  if (totalOut >= monthlyIncome) {
    out.push(`🚨 Expenses (${money(totalOut, currency)}/mo) exceed income. Cut at least ${money(totalOut - monthlyIncome, currency)}/mo before any savings are possible.`);
    return out;
  }

  // ── Fixed expense pressure ────────────────────────────────────────────────
  if (fixedPct > 0.55) {
    out.push(`⚠️ Fixed bills take ${(fixedPct * 100).toFixed(0)}% of income — that's very high. Renegotiate at least one recurring cost to unlock more savings room.`);
  }

  // ── Disposable income in red ──────────────────────────────────────────────
  if (disposableIncome <= 0) {
    out.push(`After bills and daily spending, you're ${money(Math.abs(disposableIncome), currency)} in the red monthly. Reducing variable expenses is the immediate priority.`);
    return out;
  }

  // ── Safety buffer assessment ──────────────────────────────────────────────
  if (safeSavings <= 0) {
    out.push(`The ${(safetyBufferPct * 100).toFixed(0)}% safety buffer consumes all leftover income. Trim discretionary spending to unlock even a small monthly saving.`);
  } else if (savePct >= 0.20) {
    out.push(`✅ You can safely allocate ${(savePct * 100).toFixed(0)}% of income to goals — excellent financial health. Keep it consistent.`);
  } else if (savePct >= 0.10) {
    out.push(`You have ${(savePct * 100).toFixed(0)}% of income available to save. Reaching 20% would require cutting variable spending by about ${money(monthlyIncome * 0.20 - safeSavings, currency)}/mo.`);
  } else {
    out.push(`Only ${(savePct * 100).toFixed(0)}% of income is safe to save right now. Even small consistent savings build a strong foundation — don't skip months.`);
  }

  // ── Per-goal feasibility ──────────────────────────────────────────────────
  const notFeasible = goalPlans.filter(g => g.status === 'not_feasible');
  const risky       = goalPlans.filter(g => g.status === 'risky');
  const allFeasible = goalPlans.every(g => g.status === 'feasible');

  if (notFeasible.length === 1) {
    const g = notFeasible[0];
    out.push(`❌ "${g.goalName}" needs ${money(g.requiredMonthly ?? 0, currency)}/mo to hit its deadline but only ${money(g.monthlySaving, currency)}/mo is available. Extend the deadline or increase income.`);
  } else if (notFeasible.length > 1) {
    const names = notFeasible.map(g => `"${g.goalName}"`).join(', ');
    out.push(`❌ ${notFeasible.length} goals (${names}) cannot be reached on time. Prioritise the most important and push the others back.`);
  }

  if (risky.length > 0) {
    const g = risky[0];
    out.push(`⚠️ "${g.goalName}" is ${money(g.shortfall, currency)}/mo short. A 2–3 month deadline extension or a small income boost would make it achievable.`);
  }

  // ── Income gap ────────────────────────────────────────────────────────────
  if (incomeGap > 0) {
    out.push(`You need an extra ${money(incomeGap, currency)}/mo to fund all goals on time. A side project or cutting discretionary spend by this amount closes the gap.`);
  }

  // ── All on track ──────────────────────────────────────────────────────────
  if (allFeasible && goalPlans.length > 0 && incomeGap === 0) {
    out.push(`🎯 All ${goalPlans.length} goal${goalPlans.length > 1 ? 's are' : ' is'} on track at this savings rate. Review monthly in case income or expenses change.`);
  }

  // ── No goals yet ──────────────────────────────────────────────────────────
  if (goalPlans.length === 0 && safeSavings > 0) {
    out.push(`You have ${money(safeSavings, currency)}/mo available to save but no goals set. Add a goal to put that money to work.`);
  }

  return out;
}
