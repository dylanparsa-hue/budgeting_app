import { Transaction, Budget, SavingsGoal, Insight, MonthlyStats } from '../types';

let insightCounter = 0;
const makeId = () => `insight_${++insightCounter}`;

export const generateInsights = (
  currentStats:  MonthlyStats,
  previousStats: MonthlyStats | null,
  budgets:       Budget[],
  goals:         SavingsGoal[]
): Insight[] => {
  const insights: Insight[] = [];

  // ── Savings rate ──────────────────────────────────────────────────────────
  if (currentStats.savingsRate >= 20) {
    insights.push({
      id:      makeId(),
      type:    'positive',
      icon:    '🎉',
      title:   'Great savings!',
      message: `You're saving ${currentStats.savingsRate.toFixed(0)}% of your income this month. Keep it up!`,
    });
  } else if (currentStats.savingsRate < 0) {
    insights.push({
      id:      makeId(),
      type:    'warning',
      icon:    '⚠️',
      title:   'Spending more than earning',
      message: 'Your expenses exceeded your income this month. Let\'s review your budget.',
    });
  }

  // ── Month-over-month comparison ───────────────────────────────────────────
  if (previousStats) {
    const expenseDelta = currentStats.totalExpenses - previousStats.totalExpenses;
    const pctChange    = previousStats.totalExpenses > 0
      ? Math.abs(expenseDelta / previousStats.totalExpenses) * 100
      : 0;

    if (expenseDelta < 0 && pctChange >= 5) {
      insights.push({
        id:      makeId(),
        type:    'positive',
        icon:    '📉',
        title:   'Spending down!',
        message: `You spent ${pctChange.toFixed(0)}% less than last month. Great discipline!`,
      });
    } else if (expenseDelta > 0 && pctChange >= 15) {
      // Check which category drove the increase
      const topCurrent  = currentStats.byCategory[0];
      const topPrevious = previousStats.byCategory.find(c => c.category.id === topCurrent?.category.id);
      const catDelta    = topCurrent && topPrevious
        ? ((topCurrent.amount - topPrevious.amount) / topPrevious.amount) * 100
        : 0;

      if (catDelta > 20) {
        insights.push({
          id:      makeId(),
          type:    'warning',
          icon:    '📊',
          title:   `${topCurrent.category.icon} ${topCurrent.category.name} spending up`,
          message: `Your ${topCurrent.category.name.toLowerCase()} spending increased ${catDelta.toFixed(0)}% vs last month.`,
        });
      } else {
        insights.push({
          id:      makeId(),
          type:    'warning',
          icon:    '📈',
          title:   'Spending increased',
          message: `You spent ${pctChange.toFixed(0)}% more than last month. Watch your budget!`,
        });
      }
    }

    // Savings improvement
    const savingsDelta = currentStats.savingsRate - previousStats.savingsRate;
    if (savingsDelta > 5) {
      insights.push({
        id:      makeId(),
        type:    'positive',
        icon:    '🌟',
        title:   'Saving more!',
        message: `You\'re saving ${savingsDelta.toFixed(0)}% more than last month. You\'re on a roll!`,
      });
    }
  }

  // ── Budget warnings ───────────────────────────────────────────────────────
  budgets.forEach(budget => {
    const spent = budget.spent ?? 0;
    const ratio = spent / budget.amount;

    if (ratio >= 0.9 && ratio < 1) {
      insights.push({
        id:      makeId(),
        type:    'warning',
        icon:    '⚡',
        title:   `${budget.category?.icon ?? '📦'} Budget almost full`,
        message: `You've used ${(ratio * 100).toFixed(0)}% of your ${budget.category?.name ?? 'budget'} budget.`,
      });
    } else if (ratio >= 1) {
      insights.push({
        id:      makeId(),
        type:    'warning',
        icon:    '🚨',
        title:   `${budget.category?.icon ?? '📦'} Budget exceeded`,
        message: `You've exceeded your ${budget.category?.name ?? 'budget'} budget this month.`,
      });
    }
  });

  // ── Goals progress ────────────────────────────────────────────────────────
  const nearGoal = goals.find(g => {
    const pct = (g.current_amount / g.target_amount) * 100;
    return pct >= 80 && pct < 100 && !g.is_completed;
  });

  if (nearGoal) {
    const pct = ((nearGoal.current_amount / nearGoal.target_amount) * 100).toFixed(0);
    insights.push({
      id:      makeId(),
      type:    'positive',
      icon:    nearGoal.icon,
      title:   `Almost there — ${nearGoal.name}!`,
      message: `You're ${pct}% of the way to your ${nearGoal.name} goal. So close!`,
    });
  }

  const completedGoal = goals.find(g => g.is_completed);
  if (completedGoal) {
    insights.push({
      id:      makeId(),
      type:    'positive',
      icon:    '🏆',
      title:   `Goal achieved! ${completedGoal.icon}`,
      message: `You reached your "${completedGoal.name}" goal. Celebrate and set a new one!`,
    });
  }

  // ── Default motivational message ─────────────────────────────────────────
  if (insights.length === 0) {
    const messages = [
      { icon: '💪', title: 'Keep going!',          message: 'Track every expense — small habits lead to big results.' },
      { icon: '🌱', title: 'Building good habits',  message: 'Every time you track, you grow more financially aware.' },
      { icon: '✨', title: 'You\'re doing great!',  message: 'Consistent tracking is the foundation of financial freedom.' },
      { icon: '🎯', title: 'Stay focused',           message: 'Your future self will thank you for every transaction you track.' },
    ];
    const pick = messages[new Date().getDate() % messages.length];
    insights.push({ id: makeId(), type: 'neutral', ...pick });
  }

  return insights.slice(0, 3); // Show at most 3 insights
};

export const getPrimaryInsight = (insights: Insight[]): Insight | null =>
  insights[0] ?? null;
