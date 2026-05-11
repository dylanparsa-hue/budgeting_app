/**
 * Smart Insight Engine
 *
 * Generates contextual, encouraging financial insights across four categories:
 *   1. Financial Awareness  — spending habits, unusual activity, large purchases
 *   2. Budget Control       — budget warnings and category over-spend
 *   3. Account Protection   — low balance, overdraft risk, bill reminders
 *   4. Motivation & Goals   — progress milestones, positive reinforcement
 *
 * Architecture note:
 *   This engine is intentionally decoupled from the UI so the same logic can
 *   drive both in-app cards AND push notifications (via expo-notifications)
 *   once the package is installed:
 *
 *     npx expo install expo-notifications
 *
 *   Hook into `schedulePushFromInsights()` in `notificationService.ts`.
 */

import {
  SmartInsight, InsightCategory, InsightSeverity,
  MonthlyStats, Budget, SavingsGoal, RecurringExpense,
  Transaction, NotificationPrefs,
} from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

let _counter = Date.now();
const uid = (prefix: InsightCategory) => `${prefix}_${++_counter}`;

function insight(
  category: InsightCategory,
  severity: InsightSeverity,
  icon: string,
  title: string,
  message: string,
  opts?: { actionLabel?: string; actionRoute?: string },
): SmartInsight {
  return {
    id: uid(category),
    category,
    severity,
    icon,
    title,
    message,
    actionLabel: opts?.actionLabel,
    actionRoute: opts?.actionRoute,
    createdAt:   Date.now(),
    dismissed:   false,
  };
}

function toMonthly(amount: number, frequency: string) {
  if (frequency === 'weekly')  return amount * 52 / 12;
  if (frequency === 'yearly')  return amount / 12;
  return amount;
}

// ── Engine input ──────────────────────────────────────────────────────────────

export interface InsightEngineInput {
  prefs:          NotificationPrefs;
  currentStats:   MonthlyStats;
  prevStats:      MonthlyStats | null;
  budgets:        (Budget & { spent?: number })[];
  goals:          SavingsGoal[];
  recurringItems: RecurringExpense[];
  transactions:   Transaction[];
  availableBalance: number;   // trulyAvailable from hero
  currency:       string;
  monthLabel:     string;     // e.g. "May 2026"
}

// ── 1. Financial Awareness ────────────────────────────────────────────────────

function financialAwarenessInsights(input: InsightEngineInput): SmartInsight[] {
  const { prefs, transactions, currentStats, prevStats } = input;
  const cfg = prefs.financialAwareness;
  if (!cfg.enabled) return [];

  const out: SmartInsight[] = [];
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // ── Large purchase alert ──────────────────────────────────────────────────
  if (cfg.largePurchase) {
    const recentLarge = transactions.find(
      t => t.type === 'expense' &&
           t.amount >= cfg.largePurchaseThreshold &&
           new Date(t.date).getTime() >= sevenDaysAgo,
    );
    if (recentLarge) {
      out.push(insight(
        'awareness', 'info', '💰',
        `Large expense detected`,
        `You had a purchase of ${recentLarge.amount.toFixed(0)} recently. Make sure it fits your plan.`,
        { actionLabel: 'View transactions', actionRoute: '/(tabs)/transactions' },
      ));
    }
  }

  // ── Spending habits — category increase ──────────────────────────────────
  if (cfg.spendingHabits && prevStats && currentStats.byCategory.length > 0) {
    for (const cur of currentStats.byCategory) {
      const prev = prevStats.byCategory.find(p => p.category.id === cur.category.id);
      if (!prev || prev.amount === 0) continue;
      const pctChange = ((cur.amount - prev.amount) / prev.amount) * 100;
      if (pctChange >= 30) {
        out.push(insight(
          'awareness', 'info',
          cur.category.icon ?? '📊',
          `${cur.category.name} spending up`,
          `You're spending ${pctChange.toFixed(0)}% more on ${cur.category.name.toLowerCase()} compared to last month. Worth a quick look!`,
          { actionLabel: 'View categories', actionRoute: '/(tabs)/transactions' },
        ));
        break; // one habit insight at a time
      }
    }
  }

  // ── Unusual spending — top category dominates ─────────────────────────────
  if (cfg.unusualSpending && currentStats.byCategory.length > 0) {
    const top = currentStats.byCategory[0];
    if (top.percentage > 60) {
      out.push(insight(
        'awareness', 'warning',
        top.category.icon ?? '⚠️',
        `High ${top.category.name} spending`,
        `${top.percentage.toFixed(0)}% of your expenses this month went to ${top.category.name.toLowerCase()}. You might want to diversify your spending.`,
      ));
    }
  }

  return out.slice(0, 2);
}

// ── 2. Budget Control ─────────────────────────────────────────────────────────

function budgetControlInsights(input: InsightEngineInput): SmartInsight[] {
  const { prefs, budgets } = input;
  const cfg = prefs.budgetControl;
  if (!cfg.enabled) return [];

  const out: SmartInsight[] = [];

  // Highest priority: exceeded budgets
  const exceeded = budgets.filter(b => (b.spent ?? 0) > b.amount);
  if (exceeded.length > 0) {
    const b = exceeded[0];
    out.push(insight(
      'budget', 'alert', '🚨',
      `${b.category?.icon ?? ''} ${b.category?.name ?? 'Budget'} exceeded`,
      `You've gone over your ${b.category?.name ?? 'budget'} budget. Consider adjusting it or reducing spending in this area.`,
      { actionLabel: 'Review budgets', actionRoute: '/(tabs)/budgets' },
    ));
  }

  // Near-limit warnings
  if (cfg.categoryAlerts) {
    const nearLimit = budgets.filter(b => {
      const pct = b.amount > 0 ? ((b.spent ?? 0) / b.amount) * 100 : 0;
      return pct >= cfg.warningAt && pct < 100;
    });
    if (nearLimit.length > 0) {
      const b = nearLimit[0];
      const pct = ((b.spent ?? 0) / b.amount * 100).toFixed(0);
      const remaining = (b.amount - (b.spent ?? 0)).toFixed(0);
      out.push(insight(
        'budget', 'warning', '⚡',
        `${b.category?.name ?? 'Budget'} at ${pct}%`,
        `Only about ${remaining} left in your ${b.category?.name?.toLowerCase() ?? 'budget'} budget this month.`,
        { actionLabel: 'View budgets', actionRoute: '/(tabs)/budgets' },
      ));
    }
  }

  return out.slice(0, 2);
}

// ── 3. Account Protection ─────────────────────────────────────────────────────

function accountProtectionInsights(input: InsightEngineInput): SmartInsight[] {
  const { prefs, availableBalance, recurringItems } = input;
  const cfg = prefs.accountProtection;
  if (!cfg.enabled) return [];

  const out: SmartInsight[] = [];

  // Low balance alert
  if (cfg.lowBalance && availableBalance < cfg.lowBalanceThreshold && availableBalance >= 0) {
    out.push(insight(
      'protection', 'warning', '🟡',
      `Balance is getting low`,
      `Your available balance is around ${availableBalance.toFixed(0)}. Try to hold off on non-essentials until your next income.`,
    ));
  }

  // Overdraft risk
  if (cfg.overdraftRisk && availableBalance < 0) {
    out.push(insight(
      'protection', 'alert', '🔴',
      `Spending exceeds income`,
      `Your expenses have exceeded your available balance this month. Upcoming bills may need attention.`,
      { actionLabel: 'Review plan', actionRoute: '/(tabs)/plan' },
    ));
  }

  // Upcoming bills
  if (cfg.billReminders && recurringItems.length > 0) {
    const nextMonthCommitment = recurringItems.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
    if (nextMonthCommitment > 0 && availableBalance < nextMonthCommitment * 0.8) {
      out.push(insight(
        'protection', 'info', '📅',
        `Upcoming bills reminder`,
        `Your recurring expenses next month total about ${nextMonthCommitment.toFixed(0)}. Make sure to set aside enough.`,
        { actionLabel: 'View plan', actionRoute: '/(tabs)/plan' },
      ));
    }
  }

  return out.slice(0, 2);
}

// ── 4. Motivation & Goals ─────────────────────────────────────────────────────

function motivationInsights(input: InsightEngineInput): SmartInsight[] {
  const { prefs, goals, currentStats, prevStats } = input;
  const cfg = prefs.motivation;
  if (!cfg.enabled) return [];

  const out: SmartInsight[] = [];

  // Goal milestones
  if (cfg.goalProgress) {
    for (const goal of goals) {
      if (goal.is_completed) {
        out.push(insight(
          'motivation', 'success', '🏆',
          `${goal.icon} Goal achieved!`,
          `Amazing! You reached your "${goal.name}" goal. Time to celebrate and set a new target! 🎉`,
          { actionLabel: 'View goals', actionRoute: '/(tabs)/goals' },
        ));
        break;
      }
      const pct = goal.target_amount > 0
        ? (goal.current_amount / goal.target_amount) * 100
        : 0;
      if (pct >= 75 && pct < 100) {
        out.push(insight(
          'motivation', 'success',
          goal.icon,
          `${goal.name} — almost there!`,
          `You're ${pct.toFixed(0)}% of the way to your ${goal.name} goal. One last push!`,
          { actionLabel: 'Add savings', actionRoute: '/(tabs)/goals' },
        ));
        break;
      }
      if (pct >= 50 && pct < 75) {
        out.push(insight(
          'motivation', 'info',
          goal.icon,
          `${goal.name} — halfway there`,
          `You've saved ${pct.toFixed(0)}% towards your ${goal.name} goal. Keep the momentum going!`,
        ));
        break;
      }
    }
  }

  // Monthly comparison
  if (cfg.monthlyComparison && prevStats) {
    const delta = currentStats.totalExpenses - prevStats.totalExpenses;
    const pct   = prevStats.totalExpenses > 0 ? Math.abs(delta / prevStats.totalExpenses) * 100 : 0;

    if (delta < 0 && pct >= 5) {
      out.push(insight(
        'motivation', 'success', '📉',
        `Spending down this month`,
        `You spent ${pct.toFixed(0)}% less than last month. That's real progress — great discipline!`,
      ));
    } else if (currentStats.savingsRate >= 20) {
      out.push(insight(
        'motivation', 'success', '🌟',
        `Strong savings rate`,
        `You're saving ${currentStats.savingsRate.toFixed(0)}% of your income this month. That puts you ahead of most people!`,
      ));
    }
  }

  // Positive reinforcement (fallback motivational message)
  if (cfg.positiveReinforcement && out.length === 0) {
    const messages = [
      { icon: '💪', title: 'Keep it up!',           msg: 'Every transaction you track brings you closer to financial clarity.' },
      { icon: '🌱', title: 'Building great habits',  msg: 'Consistent tracking today creates financial freedom tomorrow.' },
      { icon: '✨', title: "You're doing great!",    msg: 'Your future self will thank you for every mindful financial decision.' },
      { icon: '🎯', title: 'Stay on track',          msg: 'Small consistent actions lead to big financial results over time.' },
      { icon: '🚀', title: 'Financial clarity',      msg: 'Knowing where your money goes is the first step to making it work for you.' },
    ];
    const pick = messages[new Date().getDate() % messages.length];
    out.push(insight('motivation', 'info', pick.icon, pick.title, pick.msg));
  }

  return out.slice(0, 2);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate all smart insights for the current financial state.
 * Returns insights sorted by priority (alerts → warnings → info → success).
 */
export function generateSmartInsights(input: InsightEngineInput): SmartInsight[] {
  const all = [
    ...financialAwarenessInsights(input),
    ...budgetControlInsights(input),
    ...accountProtectionInsights(input),
    ...motivationInsights(input),
  ];

  const order: InsightSeverity[] = ['alert', 'warning', 'info', 'success'];
  const sorted = all.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  return sorted.slice(0, 6); // max 6 insights shown at once
}

/**
 * Returns the single most important insight (for the hero InsightCard).
 */
export function getPrimarySmartInsight(input: InsightEngineInput): SmartInsight | null {
  return generateSmartInsights(input)[0] ?? null;
}
