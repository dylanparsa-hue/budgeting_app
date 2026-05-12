/**
 * Dashboard — Home Screen (Waddl redesign)
 *
 * Flat header · Dark-green hero balance card · Mini stat cards
 * Budgets this month section · Recent transactions section
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import { Switch } from 'react-native';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router }         from 'expo-router';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

import { useAuthStore }         from '../../src/stores/authStore';
import { useTransactionStore }  from '../../src/stores/transactionStore';
import { useBudgetStore }       from '../../src/stores/budgetStore';
import { useGoalStore }         from '../../src/stores/goalStore';
import { useRecurringStore }    from '../../src/stores/recurringStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { useTheme }             from '../../src/theme/ThemeContext';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';

import { ProgressBar }  from '../../src/components/ui/ProgressBar';
import { generateSmartInsights } from '../../src/services/insightEngine';
import { generateBudgetPlan }   from '../../src/services/budgetAdvisor';
import { formatCurrency }        from '../../src/utils/currency';
import { CATEGORY_ICON }         from '../../src/lib/icons';

import {
  Bell, Plus, Sparkles, TrendingUp, Target, Package, ChevronRight, Pencil, Trash2,
} from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW   = new Date();
const MONTH = NOW.getMonth() + 1;
const YEAR  = NOW.getFullYear();

function shift(month: number, year: number, d: number) {
  let m = month + d, y = year;
  if (m > 12) { m = 1; y++; }
  if (m < 1)  { m = 12; y--; }
  return { month: m, year: y };
}

function toMonthly(amount: number, freq: string) {
  if (freq === 'weekly') return amount * 52 / 12;
  if (freq === 'yearly') return amount / 12;
  return amount;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─────────────────────────────────────────────────────────────────────────────
// BudgetRow sub-component
// ─────────────────────────────────────────────────────────────────────────────

function BudgetRow({
  budget, C, currency, isLast, categories,
}: {
  budget: any; C: any; currency: string; isLast: boolean; categories: any[];
}) {
  const pct      = budget.amount > 0 ? Math.min((budget.spent ?? 0) / budget.amount * 100, 100) : 0;
  const color    = pct > 90 ? C.danger : pct > 70 ? C.warning : C.success;
  const cat      = categories.find((c: any) => c.id === budget.category_id);
  const IconComp = cat ? (CATEGORY_ICON[cat.name?.toLowerCase()] ?? Package) : Package;
  const catColor = cat?.color ?? C.primary;

  return (
    <View style={[
      S.budgetRow,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
    ]}>
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: catColor + '20',
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        <IconComp size={20} color={catColor} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>
            {cat?.name ?? 'Other'}
          </Text>
          <Text style={{ ...Typography.bodySmall, color: C.textSecondary }}>
            {formatCurrency(budget.spent ?? 0, currency, { compact: true })} / {formatCurrency(budget.amount, currency, { compact: true })}
          </Text>
        </View>
        <ProgressBar progress={pct} color={color} height={6} animated />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecentTxRow sub-component
// ─────────────────────────────────────────────────────────────────────────────

function RecentTxRow({
  tx, C, currency, categories, isLast,
}: {
  tx: any; C: any; currency: string; categories: any[]; isLast: boolean;
}) {
  const cat      = categories.find((c: any) => c.id === tx.category_id);
  const IconComp = cat ? (CATEGORY_ICON[cat.name?.toLowerCase()] ?? Package) : Package;
  const catColor = cat?.color ?? C.primary;
  const isExpense = tx.type === 'expense';

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/modals/add-transaction', params: { id: tx.id } } as any)}
      style={[
        S.txRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
      ]}
      activeOpacity={0.7}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: catColor + '20',
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        <IconComp size={20} color={catColor} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...Typography.titleSmall, color: C.textPrimary }} numberOfLines={1}>
          {tx.note || cat?.name || 'Transaction'}
        </Text>
        <Text style={{ ...Typography.bodySmall, color: C.textTertiary }}>
          {cat?.name ?? ''} · {format(new Date(tx.date), 'MMM d')}
        </Text>
      </View>
      <Text style={{
        ...Typography.titleSmall,
        color: isExpense ? C.textPrimary : C.success,
        fontVariant: ['tabular-nums'] as any,
      }}>
        {isExpense ? '−' : '+'}{formatCurrency(tx.amount, currency)}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const C = useTheme();
  const { profile, user }                               = useAuthStore();
  const { transactions, syncFromServer, loadFromCache, categories } = useTransactionStore();
  const { budgets, loadBudgets, removeBudget, savingsTargetPct, loadSavingsPct } = useBudgetStore();
  const { goals, loadGoals }                            = useGoalStore();
  const { items: recurring, load: loadRecurring }       = useRecurringStore();
  const { prefs, insights, setInsights, load: loadPrefs } = useNotificationStore();
  const [refreshing, setRefreshing]       = useState(false);
  const [showPersonalBudget, setShowPersonalBudget] = useState(false);

  // Keep animation refs alive (used by old tab logic — preserved)
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Month selector (unused in new design but logic preserved) ─────────────
  const [sel, setSel] = useState({ month: MONTH, year: YEAR });
  const isCurrent     = sel.month === MONTH && sel.year === YEAR;
  const selDate       = new Date(sel.year, sel.month - 1, 1);

  const currency  = profile?.currency ?? 'MYR';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadFromCache(user.id);
    syncFromServer(user.id);
    loadBudgets(user.id, MONTH, YEAR);
    loadGoals(user.id);
    loadRecurring();
    loadPrefs();
    loadSavingsPct();
  }, [user?.id]);

  // ── Recurring monthly totals ──────────────────────────────────────────────
  const billItems = useMemo(() =>
    recurring
      .map(i => ({ ...i, monthly: toMonthly(i.amount, i.frequency) }))
      .sort((a, b) => b.monthly - a.monthly),
    [recurring]);
  const billsTotal = billItems.reduce((s, i) => s + i.monthly, 0);

  // ── Current-month transaction totals ─────────────────────────────────────
  const mStart = startOfMonth(NOW);
  const mEnd   = endOfMonth(NOW);

  const curIncome = useMemo(() =>
    transactions
      .filter(t => t.type === 'income' && isWithinInterval(new Date(t.date), { start: mStart, end: mEnd }))
      .reduce((s, t) => s + t.amount, 0),
    [transactions]);

  const curSpend = useMemo(() =>
    transactions
      .filter(t => t.type === 'expense' && isWithinInterval(new Date(t.date), { start: mStart, end: mEnd }))
      .reduce((s, t) => s + t.amount, 0),
    [transactions]);

  // True available = Income − Expenses − All Recurring
  const available      = curIncome - curSpend - billsTotal;
  // True spending = manual expenses + all recurring bills
  const totalSpentCur  = curSpend + billsTotal;
  // True savings = intentional goal allocations only
  const totalInGoals   = useMemo(
    () => goals.reduce((s, g) => s + g.current_amount, 0),
    [goals]);

  // ── Selected-month stats ──────────────────────────────────────────────────
  const selStats = useMemo(
    () => useTransactionStore.getState().getMonthlyStats(sel.month, sel.year),
    [transactions, sel]);

  const prevSel   = shift(sel.month, sel.year, -1);
  const prevStats = useMemo(
    () => useTransactionStore.getState().getMonthlyStats(prevSel.month, prevSel.year),
    [transactions, sel]);

  const selIncome = selStats.totalIncome;
  const selSpend  = selStats.totalExpenses;
  const selNet    = selIncome - selSpend - billsTotal;
  const topCats   = selStats.byCategory.slice(0, 4);

  const spendDelta = prevStats.totalExpenses > 0
    ? ((selSpend - prevStats.totalExpenses) / prevStats.totalExpenses) * 100
    : null;

  const incomeDelta = prevStats.totalIncome > 0
    ? ((selIncome - prevStats.totalIncome) / prevStats.totalIncome) * 100
    : null;

  // ── Budget progress ───────────────────────────────────────────────────────
  const budgetsWithSpend = useMemo(() => budgets.map(b => ({
    ...b,
    spent: transactions
      .filter(t =>
        t.type === 'expense' &&
        t.category_id === b.category_id &&
        new Date(t.date).getMonth() + 1 === MONTH &&
        new Date(t.date).getFullYear() === YEAR)
      .reduce((s, t) => s + t.amount, 0),
  })), [budgets, transactions]);

  const totalBudgeted = budgetsWithSpend.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgetsWithSpend.reduce((s, b) => s + (b.spent ?? 0), 0);
  const budgetPct     = totalBudgeted > 0 ? Math.min(totalSpent / totalBudgeted * 100, 100) : 0;
  const budgetColor   = budgetPct > 90 ? C.danger : budgetPct > 70 ? '#F59E0B' : C.success;

  // ── Smart insights ────────────────────────────────────────────────────────
  const curStats = useMemo(
    () => useTransactionStore.getState().getMonthlyStats(MONTH, YEAR), [transactions]);
  const prevCurStats = useMemo(
    () => useTransactionStore.getState().getMonthlyStats(
      MONTH === 1 ? 12 : MONTH - 1,
      MONTH === 1 ? YEAR - 1 : YEAR,
    ), [transactions]);

  useEffect(() => {
    setInsights(generateSmartInsights({
      prefs, currentStats: curStats, prevStats: prevCurStats,
      budgets: budgetsWithSpend, goals, recurringItems: recurring,
      transactions, availableBalance: available,
      currency, monthLabel: format(NOW, 'MMMM yyyy'),
    }));
  }, [prefs, curStats, prevCurStats, budgetsWithSpend, goals, recurring, available]);

  // ── AI Budget plan ────────────────────────────────────────────────────────
  const aiBudgetPlan = useMemo(() => generateBudgetPlan({
    transactions, recurring, goals, categories,
    savingsOverridePct: savingsTargetPct,
  }), [transactions, recurring, goals, categories, savingsTargetPct]);

  // Top 2 most urgent recommendations (over/warning first, then good)
  const topRecs = useMemo(() => {
    const ranked = [...aiBudgetPlan.recommendations].sort((a, b) => {
      const order = { over: 0, warning: 1, good: 2, excellent: 3 };
      return order[a.status] - order[b.status];
    });
    return ranked.slice(0, 2);
  }, [aiBudgetPlan]);

  // ── Goals ─────────────────────────────────────────────────────────────────
  const allActive   = goals.filter(g => !g.is_completed);
  const activeGoals = allActive.slice(0, 3);

  // ── Filtered recents ──────────────────────────────────────────────────────
  const recentIncome   = transactions.filter(t => t.type === 'income').slice(0, 5);
  const recentExpenses = transactions.filter(t => t.type === 'expense').slice(0, 5);

  // ── Tri-bar props (preserved for compatibility) ──────────────────────────
  const barTotal = selIncome + selSpend + billsTotal;
  const iPct = barTotal > 0 ? selIncome  / barTotal : 0;
  const ePct = barTotal > 0 ? selSpend   / barTotal : 0;
  const bPct = barTotal > 0 ? billsTotal / barTotal : 0;

  // ── Hero balance (all-time net) ───────────────────────────────────────────
  // True balance = all-time (income − expenses) − monthly recurring obligations
  const heroBalance = useMemo(() => {
    let bal = 0;
    for (const t of transactions) {
      if (t.type === 'income') bal += t.amount;
      else bal -= t.amount;
    }
    return bal - billsTotal;
  }, [transactions, billsTotal]);

  const balFormatted = formatCurrency(Math.abs(heroBalance), currency);
  const balParts     = balFormatted.split('.');
  const intPart      = balParts[0];
  const centsPart    = balParts[1] ?? '00';

  const heroDeltaText = incomeDelta !== null
    ? `${incomeDelta >= 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(selIncome - prevStats.totalIncome), currency, { compact: true })} vs last month`
    : null;

  // ── Refresh ───────────────────────────────────────────────────────────────
  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await Promise.all([
      syncFromServer(user.id),
      loadBudgets(user.id, MONTH, YEAR),
      loadGoals(user.id),
    ]);
    setRefreshing(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[S.safe, { backgroundColor: C.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >

        {/* ════════ Flat header ════════ */}
        <View style={S.header}>
          <View>
            <Text style={[S.headerGreeting, { color: C.textSecondary }]}>{greeting()}</Text>
            <Text style={[S.headerName, { color: C.textPrimary }]}>{firstName}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={[S.notifBtn, { backgroundColor: C.surface, shadowColor: '#0E2417' }]}
          >
            <Bell size={20} color={C.textPrimary} strokeWidth={2} />
            {insights.length > 0 && (
              <View style={[S.notifDot, { backgroundColor: C.danger }]} />
            )}
          </TouchableOpacity>
        </View>

        {/* ════════ Hero balance card ════════ */}
        <LinearGradient
          colors={['#0E2417', '#1A2B22']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.hero}
        >
          {/* Decorative glow blobs */}
          <View style={S.heroBg1} />
          <View style={S.heroBg2} />

          {/* Top row: label + W badge */}
          <View style={S.heroTopRow}>
            <Text style={S.heroLabel}>TOTAL BALANCE</Text>
            <View style={S.wBadge}>
              <Text style={S.wBadgeText}>W</Text>
            </View>
          </View>

          {/* Balance amount: integer + cents */}
          <View style={S.heroAmtRow}>
            <Text style={S.heroAmtInt} adjustsFontSizeToFit numberOfLines={1}>
              {heroBalance < 0 ? '−' : ''}{intPart}
            </Text>
            <Text style={S.heroAmtCents}>.{centsPart}</Text>
          </View>

          {/* Delta pill */}
          {heroDeltaText && (
            <View style={S.heroDeltaPill}>
              <Text style={[S.heroDeltaText, { color: C.primary }]}>{heroDeltaText}</Text>
            </View>
          )}

          {/* Quick action chips */}
          <View style={S.heroChips}>
            {[
              { Icon: Plus,        label: 'Add',          onPress: () => router.push('/modals/add-transaction') },
              { Icon: TrendingUp,  label: 'Transactions', onPress: () => router.push('/(tabs)/transactions' as any) },
              { Icon: Sparkles,    label: 'Insights',     onPress: () => router.push('/(tabs)/budgets') },
              { Icon: Target,      label: 'Goals',        onPress: () => router.push('/(tabs)/goals') },
            ].map(({ Icon, label, onPress }) => (
              <TouchableOpacity
                key={label}
                onPress={onPress}
                style={S.heroChip}
                activeOpacity={0.75}
              >
                <Icon size={18} color="#fff" strokeWidth={2} />
                <Text style={S.heroChipLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* ════════ Mini stat cards ════════ */}
        <View style={S.miniCards}>
          {/* Spent */}
          <View style={[S.miniCard, { backgroundColor: C.surface }, Shadow.sm]}>
            <Text style={[S.miniCardLabel, { color: C.textSecondary }]}>Spent this month</Text>
            <Text style={[S.miniCardAmt, { color: C.textPrimary }]}>
              {formatCurrency(totalSpentCur, currency, { compact: true })}
            </Text>
            {spendDelta !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Text style={[S.miniCardDelta, { color: spendDelta >= 0 ? C.danger : C.success }]}>
                  {spendDelta >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(selSpend - prevStats.totalExpenses), currency, { compact: true })} vs last month
                </Text>
              </View>
            )}
          </View>

          {/* Saved */}
          <View style={[S.miniCard, { backgroundColor: C.surface }, Shadow.sm]}>
            <Text style={[S.miniCardLabel, { color: C.textSecondary }]}>Saved this month</Text>
            <Text style={[S.miniCardAmt, { color: C.textPrimary }]}>
              {formatCurrency(totalInGoals, currency, { compact: true })}
            </Text>
            {allActive.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Text style={[S.miniCardDelta, { color: C.success }]}>
                  {allActive.length} active goal{allActive.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ════════ Budgets this month ════════ */}
        <View style={S.sectionHeader}>
          <Text style={[S.sectionTitle, { color: C.textPrimary }]}>Budgets this month</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/budgets')}>
            <Text style={[S.seeAll, { color: C.textSecondary }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {/* AI ↔ Personal toggle row */}
        <View style={[S.budgetToggleRow, { backgroundColor: C.surface }, Shadow.sm]}>
          <View style={S.budgetToggleLeft}>
            <View style={[S.budgetToggleIcon, { backgroundColor: showPersonalBudget ? C.surfaceRaised : '#9FE87020' }]}>
              <Sparkles size={14} color={showPersonalBudget ? C.textTertiary : '#9FE870'} strokeWidth={2} />
            </View>
            <View>
              <Text style={[S.budgetToggleTitle, { color: C.textPrimary }]}>
                {showPersonalBudget ? 'My Budgets' : 'AI Recommended'}
              </Text>
              <Text style={[S.budgetToggleSub, { color: C.textTertiary }]}>
                {showPersonalBudget ? 'Your custom limits' : 'Based on your habits'}
              </Text>
            </View>
          </View>
          <Switch
            value={showPersonalBudget}
            onValueChange={setShowPersonalBudget}
            trackColor={{ false: '#9FE870', true: C.surfaceRaised }}
            thumbColor={showPersonalBudget ? C.textSecondary : '#0E2417'}
          />
        </View>

        {/* ── AI Budget view (default) ── */}
        {!showPersonalBudget && (
          <>
            {aiBudgetPlan.monthlyIncome === 0 ? (
              <TouchableOpacity
                onPress={() => router.push('/modals/add-transaction')}
                style={[S.emptyCard, { backgroundColor: C.surface, borderColor: C.border }, Shadow.sm]}
              >
                <Text style={[S.emptyCardText, { color: C.textTertiary }]}>Add income to unlock AI budget recommendations</Text>
              </TouchableOpacity>
            ) : (
              <>
                {/* Compact coach message */}
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/budgets')}
                  activeOpacity={0.85}
                  style={[S.aiCoachCard, { backgroundColor: '#0E2417' }, Shadow.sm]}
                >
                  <View style={S.aiCoachBg} />
                  {/* Top row: icon + score */}
                  <View style={S.aiCoachRow}>
                    <View style={S.aiCoachIconBox}>
                      <Sparkles size={16} color="#9FE870" strokeWidth={2} />
                    </View>
                    <Text style={S.aiCoachLabel}>AI BUDGET COACH</Text>
                    <View style={[S.aiHealthBadge, {
                      backgroundColor: aiBudgetPlan.healthScore >= 80 ? '#9FE87025'
                        : aiBudgetPlan.healthScore >= 55 ? '#F59E0B25' : '#EF444425',
                    }]}>
                      <Text style={[S.aiHealthNum, {
                        color: aiBudgetPlan.healthScore >= 80 ? '#9FE870'
                          : aiBudgetPlan.healthScore >= 55 ? '#F59E0B' : '#EF4444',
                      }]}>{aiBudgetPlan.healthScore}</Text>
                      <Text style={S.aiHealthSub}>score</Text>
                    </View>
                  </View>
                  {/* Full message — no numberOfLines, card expands */}
                  <Text style={S.aiCoachMsg}>{aiBudgetPlan.coachMessage}</Text>
                  <View style={S.aiCoachFooter}>
                    <Text style={S.aiCoachFooterText}>View full AI budget plan</Text>
                    <ChevronRight size={14} color="rgba(255,255,255,0.4)" strokeWidth={2} />
                  </View>
                </TouchableOpacity>

                {/* AI category rows */}
                <View style={[S.listCard, { backgroundColor: C.surface }, Shadow.sm]}>
                  {aiBudgetPlan.recommendations
                    .filter(r => r.priority !== 'savings')
                    .slice(0, 4)
                    .map((rec, i, arr) => {
                      const pct      = rec.recommendedAmount > 0
                        ? Math.min((rec.currentSpend / rec.recommendedAmount) * 100, 100) : 0;
                      const barColor = rec.status === 'over' ? C.danger
                        : rec.status === 'warning' ? '#F59E0B'
                        : rec.status === 'excellent' ? C.success : C.primary;
                      return (
                        <View
                          key={rec.id}
                          style={[
                            S.budgetRow,
                            i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
                          ]}
                        >
                          <View style={{
                            width: 40, height: 40, borderRadius: 12,
                            backgroundColor: rec.color + '20',
                            alignItems: 'center', justifyContent: 'center', marginRight: 12,
                          }}>
                            <Text style={{ fontSize: 18 }}>{rec.icon}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{rec.categoryName}</Text>
                              <Text style={{ ...Typography.bodySmall, color: C.textSecondary }}>
                                {formatCurrency(rec.currentSpend, currency, { compact: true })} / {formatCurrency(rec.recommendedAmount, currency, { compact: true })}
                              </Text>
                            </View>
                            <ProgressBar progress={pct} color={barColor} height={6} animated />
                          </View>
                        </View>
                      );
                    })
                  }
                </View>
              </>
            )}
          </>
        )}

        {/* ── Personal Budget view (toggled) ── */}
        {showPersonalBudget && (
          budgetsWithSpend.length > 0 ? (
            <>
              <View style={[S.personalBudgetList, { backgroundColor: C.surface }, Shadow.sm]}>
                {budgetsWithSpend.map((b, i) => {
                  const pct      = b.amount > 0 ? Math.min((b.spent ?? 0) / b.amount * 100, 100) : 0;
                  const barColor = pct > 90 ? C.danger : pct > 70 ? '#F59E0B' : C.success;
                  const cat      = categories.find(c => c.id === b.category_id);
                  const IconComp = cat ? (CATEGORY_ICON[cat.name?.toLowerCase()] ?? Package) : Package;
                  const catColor = cat?.color ?? C.primary;
                  return (
                    <View
                      key={b.id ?? i}
                      style={[
                        S.personalBudgetRow,
                        i < budgetsWithSpend.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
                      ]}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: catColor + '20', alignItems: 'center', justifyContent: 'center' }}>
                        <IconComp size={20} color={catColor} strokeWidth={2.25} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{cat?.name ?? 'Budget'}</Text>
                          <Text style={{ ...Typography.bodySmall, color: pct > 90 ? C.danger : C.textSecondary }}>
                            {formatCurrency(b.spent ?? 0, currency, { compact: true })} / {formatCurrency(b.amount, currency, { compact: true })}
                          </Text>
                        </View>
                        <ProgressBar progress={pct} color={barColor} height={6} animated />
                      </View>
                      {/* Edit + Delete actions */}
                      <View style={S.personalBudgetActions}>
                        <TouchableOpacity
                          onPress={() => router.push(`/modals/add-budget?id=${b.id}` as any)}
                          style={[S.personalBudgetActionBtn, { backgroundColor: C.primaryLight }]}
                        >
                          <Pencil size={13} color={C.primary} strokeWidth={2.5} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => b.id && removeBudget(b.id)}
                          style={[S.personalBudgetActionBtn, { backgroundColor: C.dangerLight }]}
                        >
                          <Trash2 size={13} color={C.danger} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() => router.push('/modals/add-budget')}
                style={[S.addPersonalBudgetBtn, { borderColor: C.border }]}
              >
                <Text style={[S.addPersonalBudgetText, { color: C.primary }]}>+ Add another budget</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/modals/add-budget')}
              style={[S.emptyCard, { backgroundColor: C.surface, borderColor: C.border }, Shadow.sm]}
            >
              <Text style={[S.emptyCardText, { color: C.textTertiary }]}>No personal budgets yet — tap to add one</Text>
            </TouchableOpacity>
          )
        )}

        {/* ════════ Recent transactions ════════ */}
        <View style={[S.sectionHeader, { marginTop: 24 }]}>
          <Text style={[S.sectionTitle, { color: C.textPrimary }]}>Recent</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions' as any)}>
            <Text style={[S.seeAll, { color: C.textSecondary }]}>See all →</Text>
          </TouchableOpacity>
        </View>
        {recentExpenses.length > 0 ? (
          <View style={[S.listCard, { backgroundColor: C.surface, marginBottom: 40 }, Shadow.sm]}>
            {recentExpenses.slice(0, 5).map((tx, i) => (
              <RecentTxRow
                key={tx.id}
                tx={tx}
                C={C}
                currency={currency}
                categories={categories}
                isLast={i === Math.min(recentExpenses.length, 5) - 1}
              />
            ))}
          </View>
        ) : (
          <View style={[S.emptyCard, { backgroundColor: C.surface, borderColor: C.border, marginBottom: 40 }, Shadow.sm]}>
            <Text style={[S.emptyCardText, { color: C.textTertiary }]}>No transactions yet</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerGreeting: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  headerName: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    fontWeight: '700',
  },
  notifBtn: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
    elevation: 1,
  },
  notifDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
  },

  // Hero card
  hero: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
    gap: 0,
  },
  heroBg1: {
    position: 'absolute', top: -60, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(159,232,112,0.06)',
  },
  heroBg2: {
    position: 'absolute', bottom: -50, left: -30,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)',
  },
  wBadge: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  wBadgeText: {
    fontFamily: FontFamily.display,
    fontSize: 14, fontWeight: '700', color: '#fff',
  },
  heroAmtRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  heroAmtInt: {
    fontFamily: FontFamily.display,
    fontSize: 48, fontWeight: '800',
    color: '#fff', letterSpacing: -2,
  },
  heroAmtCents: {
    fontFamily: FontFamily.display,
    fontSize: 24, fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  heroDeltaPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(159,232,112,0.18)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  heroDeltaText: {
    fontSize: 13, fontWeight: '600',
  },
  heroChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  heroChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  heroChipLabel: {
    fontSize: 12, fontWeight: '600', color: '#fff',
  },

  // Mini stat cards
  miniCards: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  miniCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
  },
  miniCardLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  miniCardAmt: {
    fontFamily: FontFamily.display,
    fontSize: 26, fontWeight: '800',
    letterSpacing: -0.5,
  },
  miniCardDelta: {
    fontSize: 12, fontWeight: '500',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18, fontWeight: '700',
  },
  seeAll: {
    fontSize: 15,
  },

  // List card (budgets + recent tx container)
  listCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Budget row
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  // Transaction row
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  // Empty card
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyCardText: { fontSize: 14 },

  // Personal budget list
  personalBudgetList: { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
  personalBudgetRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  personalBudgetActions: { flexDirection: 'row', gap: 6, marginLeft: 10 },
  personalBudgetActionBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  addPersonalBudgetBtn: {
    marginHorizontal: 16, marginTop: 8,
    paddingVertical: 12, borderRadius: 14,
    alignItems: 'center', borderWidth: 1, borderStyle: 'dashed' as const,
  },
  addPersonalBudgetText: { fontSize: 14, fontWeight: '600' },

  // Budget toggle row
  budgetToggleRow: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  budgetToggleLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  budgetToggleIcon:  { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  budgetToggleTitle: { fontSize: 14, fontWeight: '700' },
  budgetToggleSub:   { fontSize: 11, marginTop: 1 },

  // AI Coach card
  aiCoachCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    overflow: 'hidden',
  },
  aiCoachBg: {
    position: 'absolute', top: -50, right: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(159,232,112,0.06)',
  },
  aiCoachRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiCoachIconBox:{
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(159,232,112,0.15)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  aiCoachLabel:  { flex: 1, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1, textTransform: 'uppercase' as const },
  aiCoachMsg:    { fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 19 },
  aiHealthBadge: {
    alignItems: 'center', borderRadius: 10, flexShrink: 0,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  aiHealthNum:   { fontSize: 16, fontWeight: '800', lineHeight: 19 },
  aiHealthSub:   { fontSize: 9,  fontWeight: '600', color: 'rgba(255,255,255,0.4)', lineHeight: 11 },

  aiRecList:  { gap: 8 },
  aiRecRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiRecIcon:  { fontSize: 18 },
  aiRecName:  { fontSize: 13, fontWeight: '600', color: '#fff' },
  aiRecReason:{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  aiRecPill:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  aiRecAmt:   { fontSize: 13, fontWeight: '700' },

  aiCoachFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, opacity: 0.6 },
  aiCoachFooterText: { fontSize: 12, color: '#fff', fontWeight: '600' },
});
