/**
 * Dashboard — Home Screen
 *
 * Three-tab layout: Income · Spent · Saved
 *
 * ┌─ SegmentedToggle ──────────────────────────────┐
 * │  [ ↑ Income ]  [ ↓ Spent ]  [ ★ Saved ]       │
 * └────────────────────────────────────────────────┘
 *  Hero card           — adapts headline + amount per tab
 *  FinancialChart      — always visible, 6-month default
 *  ─ tab content ─────────────────────────────────
 *  income → Income breakdown + recent income
 *  spent  → Net balance overview + categories + bills + recent expenses
 *  saved  → Savings summary + goals + budget
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Typography }           from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';

import { ProgressBar }         from '../../src/components/ui/ProgressBar';
import { TransactionItem }     from '../../src/components/transactions/TransactionItem';
import { FinancialChart }      from '../../src/components/dashboard/FinancialChart';
import {
  SegmentedToggle,
  DashboardTab,
}                              from '../../src/components/dashboard/SegmentedToggle';

import { generateSmartInsights } from '../../src/services/insightEngine';
import { formatCurrency }        from '../../src/utils/currency';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW   = new Date();
const MONTH = NOW.getMonth() + 1;
const YEAR  = NOW.getFullYear();

const BILL_ICON: Record<string, string> = {
  subscription: '📱', utilities: '⚡', debt: '💳',
  insurance: '🛡️', transport: '🚗', rent: '🏠', other: '📦',
};

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
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const C = useTheme();
  const { profile, user }                               = useAuthStore();
  const { transactions, syncFromServer, loadFromCache } = useTransactionStore();
  const { budgets, loadBudgets }                        = useBudgetStore();
  const { goals, loadGoals }                            = useGoalStore();
  const { items: recurring, load: loadRecurring }       = useRecurringStore();
  const { prefs, insights, setInsights, load: loadPrefs } = useNotificationStore();
  const [refreshing, setRefreshing] = useState(false);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<DashboardTab>('spent');
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleTabChange = useCallback((tab: DashboardTab) => {
    // Quick fade out + slide up
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 90,  useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -6, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      setActiveTab(tab);
      // Spring back in from below
      slideAnim.setValue(10);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true, speed: 28, bounciness: 3,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  // ── Month selector (hero) ─────────────────────────────────────────────────
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
  // True savings = intentional goal allocations only (NOT remaining balance)
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

  // ── Goals ─────────────────────────────────────────────────────────────────
  const allActive   = goals.filter(g => !g.is_completed);
  const activeGoals = allActive.slice(0, 3);

  // ── Filtered recents ──────────────────────────────────────────────────────
  const recentIncome   = transactions.filter(t => t.type === 'income').slice(0, 5);
  const recentExpenses = transactions.filter(t => t.type === 'expense').slice(0, 5);

  // ── Hero config per tab ───────────────────────────────────────────────────
  const heroConfig = useMemo(() => {
    switch (activeTab) {
      case 'income':
        return {
          label:  'INCOME THIS MONTH',
          amount: curIncome,
          delta:  incomeDelta,
          suffix: incomeDelta !== null
            ? `${incomeDelta >= 0 ? '▲' : '▼'} ${Math.abs(incomeDelta).toFixed(0)}% vs last month`
            : null,
          isNegative: false,
        };
      case 'spent':
        return {
          label:  'SPENT THIS MONTH',
          amount: totalSpentCur,
          delta:  spendDelta,
          suffix: spendDelta !== null
            ? `${spendDelta >= 0 ? '▲' : '▼'} ${Math.abs(spendDelta).toFixed(0)}% vs last month`
            : null,
          isNegative: false,
        };
      case 'saved':
        return {
          label:  'IN SAVINGS GOALS',
          amount: totalInGoals,
          delta:  null,
          suffix: available > 0
            ? `${formatCurrency(available, currency, { compact: true })} available to allocate`
            : available < 0 ? 'Over budget this month' : null,
          isNegative: false,
        };
    }
  }, [activeTab, curIncome, totalSpentCur, totalInGoals, incomeDelta, spendDelta, available, currency]);

  // ── Tri-bar props ─────────────────────────────────────────────────────────
  const barTotal = selIncome + selSpend + billsTotal;
  const iPct = barTotal > 0 ? selIncome  / barTotal : 0;
  const ePct = barTotal > 0 ? selSpend   / barTotal : 0;
  const bPct = barTotal > 0 ? billsTotal / barTotal : 0;

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
        contentContainerStyle={[S.scroll, { paddingBottom: 120 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >

        {/* ════════════════════════════════════════════════════
            SEGMENTED TOGGLE
        ════════════════════════════════════════════════════ */}
        <SegmentedToggle active={activeTab} onChange={handleTabChange} />

        {/* ════════════════════════════════════════════════════
            HERO — adapts to active tab
        ════════════════════════════════════════════════════ */}
        <LinearGradient
          colors={C.gradients.hero as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.hero}
        >
          <View style={S.heroBg1} />
          <View style={S.heroBg2} />

          {/* Header row */}
          <View style={S.heroHeader}>
            <View>
              <Text style={S.heroGreeting}>{greeting()}</Text>
              <Text style={S.heroName}>{firstName} 👋</Text>
            </View>
            <View style={S.heroActions}>
              {insights.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push('/modals/notification-settings' as any)}
                  style={S.heroIconBtn}
                >
                  <Text style={S.heroIconEmoji}>🔔</Text>
                  <View style={[S.notifBadge, { backgroundColor: C.danger }]}>
                    <Text style={S.notifBadgeText}>{Math.min(insights.length, 9)}</Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profile')}
                style={S.heroIconBtn}
              >
                <Text style={S.heroIconEmoji}>⚙️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab-adaptive balance */}
          <View style={S.heroBalanceBlock}>
            <Text style={S.heroBalanceLabel}>{heroConfig.label}</Text>
            <Text
              style={[
                S.heroBalanceAmt,
                heroConfig.isNegative && { color: '#fca5a5' },
              ]}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {heroConfig.isNegative ? '−' : ''}{formatCurrency(heroConfig.amount, currency)}
            </Text>
            {heroConfig.suffix && (
              <View style={S.heroSuffixBadge}>
                <Text style={S.heroSuffixText}>{heroConfig.suffix}</Text>
              </View>
            )}
          </View>

          {/* Month picker */}
          <View style={S.monthPicker}>
            <TouchableOpacity
              onPress={() => setSel(s => shift(s.month, s.year, -1))}
              hitSlop={{ top: 12, bottom: 12, left: 20, right: 10 }}
            >
              <Text style={S.monthChevron}>‹</Text>
            </TouchableOpacity>
            <Text style={S.monthLabel}>{format(selDate, 'MMMM yyyy')}</Text>
            <TouchableOpacity
              onPress={() => !isCurrent && setSel(s => shift(s.month, s.year, 1))}
              hitSlop={{ top: 12, bottom: 12, left: 10, right: 20 }}
              style={{ opacity: isCurrent ? 0.25 : 1 }}
            >
              <Text style={S.monthChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={S.heroStatsRow}>
            <HeroStat icon="↑" label="Income"   value={formatCurrency(selIncome,  currency, { compact: true })} color="#6ee7b7" highlight={activeTab === 'income'} />
            <View style={S.heroStatDivider} />
            <HeroStat icon="↓" label="Spent"     value={formatCurrency(selSpend + billsTotal, currency, { compact: true })} color="#fca5a5" highlight={activeTab === 'spent'} />
            <View style={S.heroStatDivider} />
            <HeroStat icon="◆" label="Available" value={formatCurrency(Math.max(selNet, 0),    currency, { compact: true })} color="#c4b5fd" highlight={activeTab === 'saved'} />
          </View>
        </LinearGradient>

        {/* ════════════════════════════════════════════════════
            FINANCIAL CHART — always visible
        ════════════════════════════════════════════════════ */}
        <FinancialChart
          transactions={transactions}
          recurring={recurring}
          currency={currency}
        />

        {/* ════════════════════════════════════════════════════
            TAB CONTENT — animated crossfade between tabs
        ════════════════════════════════════════════════════ */}
        <Animated.View
          style={[
            S.tabContent,
            {
              opacity:   fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >

          {/* ── INCOME TAB ───────────────────────────────────── */}
          {activeTab === 'income' && (
            <View style={S.tabSection}>

              {/* Income overview card */}
              <View style={[S.card, { backgroundColor: C.surface }]}>
                <CardHeader title="Income Overview" />
                <View style={S.incomeSummaryRow}>
                  <IncomeStat
                    label="This Month"
                    value={formatCurrency(selIncome, currency)}
                    color={C.success}
                  />
                  <View style={[S.vertDivider, { backgroundColor: C.divider }]} />
                  <IncomeStat
                    label="Last Month"
                    value={formatCurrency(prevStats.totalIncome, currency)}
                    color={C.textSecondary}
                  />
                  <View style={[S.vertDivider, { backgroundColor: C.divider }]} />
                  <IncomeStat
                    label="Change"
                    value={
                      incomeDelta !== null
                        ? `${incomeDelta >= 0 ? '+' : ''}${incomeDelta.toFixed(0)}%`
                        : '—'
                    }
                    color={
                      incomeDelta === null ? C.textTertiary
                        : incomeDelta >= 0 ? C.success : C.danger
                    }
                  />
                </View>
                {incomeDelta !== null && (
                  <View style={[S.incomeProgressWrap, { borderTopColor: C.divider }]}>
                    <ProgressBar
                      progress={Math.min(Math.abs(incomeDelta), 100)}
                      color={incomeDelta >= 0 ? C.success : C.danger}
                      height={5}
                      animated
                    />
                    <Text style={[S.cap, { color: C.textTertiary, marginTop: Spacing[1] }]}>
                      {incomeDelta >= 0
                        ? `Income is up ${incomeDelta.toFixed(0)}% compared to last month 🎉`
                        : `Income is down ${Math.abs(incomeDelta).toFixed(0)}% compared to last month`}
                    </Text>
                  </View>
                )}
              </View>

              {/* Recent income */}
              {recentIncome.length > 0 && (
                <View style={{ gap: Spacing[3] }}>
                  <View style={S.sectionHeaderRow}>
                    <Text style={[S.cardTitle, { color: C.textPrimary }]}>Recent Income</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                      <Text style={[S.linkBtn, { color: C.primary }]}>See all →</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[S.txCard, { backgroundColor: C.surface }]}>
                    {recentIncome.map((tx, i) => (
                      <View key={tx.id}>
                        <View style={S.txRow}>
                          <TransactionItem transaction={tx} currency={currency} />
                        </View>
                        {i < recentIncome.length - 1 && (
                          <View style={[S.hairline, { backgroundColor: C.divider, marginHorizontal: Spacing[4] }]} />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {recentIncome.length === 0 && (
                <EmptyCard icon="💰" title="No income recorded" sub="Add your salary or other income sources" />
              )}
            </View>
          )}

          {/* ── SPENT TAB ────────────────────────────────────── */}
          {activeTab === 'spent' && (
            <View style={S.tabSection}>

              {/* Net Balance */}
              <View style={[S.card, { backgroundColor: C.surface }]}>
                <View style={S.netRow}>
                  <View style={{ gap: 3 }}>
                    <Text style={[S.overline, { color: C.textTertiary }]}>
                      AVAILABLE BALANCE · {format(selDate, 'MMM yyyy').toUpperCase()}
                    </Text>
                    <Text style={[S.netAmt, { color: selNet >= 0 ? C.success : C.danger }]}>
                      {selNet >= 0 ? '+' : ''}{formatCurrency(selNet, currency)}
                    </Text>
                  </View>
                  {spendDelta !== null && (
                    <View style={[S.deltaPill, { backgroundColor: (spendDelta > 0 ? C.danger : C.success) + '18' }]}>
                      <Text style={[S.deltaTxt, { color: spendDelta > 0 ? C.danger : C.success }]}>
                        {spendDelta > 0 ? '▲' : '▼'} {Math.abs(spendDelta).toFixed(0)}%
                      </Text>
                    </View>
                  )}
                </View>

                {barTotal > 0 && (
                  <View style={S.barSection}>
                    <View style={[S.triBar, { backgroundColor: C.border }]}>
                      {iPct > 0 && <View style={[S.barSeg, { flex: iPct, backgroundColor: C.success, borderTopLeftRadius: 5, borderBottomLeftRadius: 5 }]} />}
                      {ePct > 0 && <View style={[S.barSeg, { flex: ePct, backgroundColor: C.danger, borderTopRightRadius: bPct <= 0 ? 5 : 0, borderBottomRightRadius: bPct <= 0 ? 5 : 0 }]} />}
                      {bPct > 0 && <View style={[S.barSeg, { flex: bPct, backgroundColor: '#a78bfa', borderTopRightRadius: 5, borderBottomRightRadius: 5 }]} />}
                    </View>
                    <View style={S.barLegend}>
                      <LegendItem color={C.success} label="Income"   value={formatCurrency(selIncome,  currency)} />
                      <LegendItem color={C.danger}  label="Expenses" value={formatCurrency(selSpend,   currency)} />
                      {billsTotal > 0 && <LegendItem color="#a78bfa" label="Bills" value={formatCurrency(billsTotal, currency)} />}
                    </View>
                  </View>
                )}

                {isCurrent && totalBudgeted > 0 && (
                  <View style={[S.budgetBlock, { borderTopColor: C.divider }]}>
                    <View style={S.budgetBlockHeader}>
                      <Text style={[S.labelBody, { color: C.textSecondary }]}>Monthly Budget</Text>
                      <TouchableOpacity onPress={() => router.push('/(tabs)/budgets')}>
                        <Text style={[S.linkBtn, { color: C.primary }]}>View all →</Text>
                      </TouchableOpacity>
                    </View>
                    <ProgressBar progress={budgetPct} color={budgetColor} height={7} animated />
                    <View style={S.budgetBlockFooter}>
                      <Text style={[S.cap, { color: C.textTertiary }]}>{budgetPct.toFixed(0)}% of {formatCurrency(totalBudgeted, currency)}</Text>
                      <Text style={[S.capBold, { color: budgetPct > 90 ? C.danger : C.success }]}>
                        {formatCurrency(Math.max(totalBudgeted - totalSpent, 0), currency)} left
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Top Categories */}
              <View style={[S.card, { backgroundColor: C.surface }]}>
                <CardHeader
                  title="Top Categories"
                  action={topCats.length > 0 ? 'See all →' : undefined}
                  onAction={() => router.push('/(tabs)/transactions')}
                />
                {topCats.length === 0 ? (
                  <EmptyState icon="📊" message={`No expenses in ${format(selDate, 'MMMM')} yet`} />
                ) : (
                  <View style={{ gap: 0 }}>
                    {topCats.map(({ category, amount, percentage }, idx) => (
                      <View key={category.id}>
                        {idx > 0 && <View style={[S.hairline, { backgroundColor: C.divider, marginVertical: Spacing[3] }]} />}
                        <View style={S.catRow}>
                          <View style={[S.catIconBox, { backgroundColor: category.color + '18' }]}>
                            <Text style={S.catIconText}>{category.icon}</Text>
                          </View>
                          <View style={S.catContent}>
                            <View style={S.catTopLine}>
                              <Text style={[S.labelBody, { color: C.textPrimary, flex: 1 }]} numberOfLines={1}>{category.name}</Text>
                              <Text style={[S.labelBody, { color: C.textSecondary }]}>{formatCurrency(amount, currency)}</Text>
                            </View>
                            <ProgressBar progress={percentage} color={category.color} height={4} animated />
                          </View>
                          <View style={[S.pctBadge, { backgroundColor: category.color + '18' }]}>
                            <Text style={[S.pctText, { color: category.color }]}>{percentage.toFixed(0)}%</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Upcoming Bills */}
              {billItems.length > 0 ? (
                <View style={[S.card, { backgroundColor: C.surface }]}>
                  <View style={S.billsTopRow}>
                    <View>
                      <Text style={[S.cardTitle, { color: C.textPrimary }]}>Upcoming Bills</Text>
                      <Text style={[S.cap, { color: C.textTertiary, marginTop: 2 }]}>Monthly recurring</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
                      <TouchableOpacity onPress={() => router.push('/modals/manage-recurring' as any)}>
                        <Text style={[S.linkBtn, { color: C.primary }]}>Manage →</Text>
                      </TouchableOpacity>
                      <View style={[S.totalPill, { backgroundColor: C.dangerLight }]}>
                        <Text style={[S.totalPillText, { color: C.danger }]}>
                          {formatCurrency(billsTotal, currency, { compact: true })}/mo
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View>
                    {billItems.map((item, idx) => (
                      <View key={item.id}>
                        {idx > 0 && <View style={[S.hairline, { backgroundColor: C.divider }]} />}
                        <View style={S.billRow}>
                          <View style={[S.billIconBox, { backgroundColor: C.surfaceRaised }]}>
                            <Text style={S.billIconText}>{BILL_ICON[item.category] ?? '📦'}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={[S.labelBody, { color: C.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                            <Text style={[S.cap, { color: C.textTertiary }]}>
                              {item.frequency === 'monthly' ? 'Monthly' : item.frequency === 'weekly' ? 'Weekly' : 'Yearly'}
                            </Text>
                          </View>
                          <Text style={[S.labelBody, { color: C.danger, fontWeight: '700' }]}>
                            −{formatCurrency(item.monthly, currency)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={[S.billFooter, { borderTopColor: C.divider }]}>
                    <Text style={[S.cap, { color: C.textSecondary }]}>Total monthly</Text>
                    <Text style={[S.labelBody, { color: C.danger, fontWeight: '800' }]}>
                      −{formatCurrency(billsTotal, currency)}
                    </Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push('/modals/manage-recurring' as any)}
                  activeOpacity={0.7}
                  style={[S.dashedCard, { borderColor: C.border, backgroundColor: C.surface }]}
                >
                  <Text style={{ fontSize: 26 }}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.labelBody, { color: C.textPrimary }]}>Track recurring bills</Text>
                    <Text style={[S.cap, { color: C.textTertiary }]}>Rent, subscriptions, utilities</Text>
                  </View>
                  <Text style={[S.labelBody, { color: C.primary }]}>›</Text>
                </TouchableOpacity>
              )}

              {/* Recent expenses */}
              {recentExpenses.length > 0 && (
                <View style={{ gap: Spacing[3] }}>
                  <View style={S.sectionHeaderRow}>
                    <Text style={[S.cardTitle, { color: C.textPrimary }]}>Recent Expenses</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                      <Text style={[S.linkBtn, { color: C.primary }]}>See all →</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[S.txCard, { backgroundColor: C.surface }]}>
                    {recentExpenses.map((tx, i) => (
                      <View key={tx.id}>
                        <View style={S.txRow}>
                          <TransactionItem transaction={tx} currency={currency} />
                        </View>
                        {i < recentExpenses.length - 1 && (
                          <View style={[S.hairline, { backgroundColor: C.divider, marginHorizontal: Spacing[4] }]} />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── SAVED TAB ────────────────────────────────────── */}
          {activeTab === 'saved' && (
            <View style={S.tabSection}>

              {/* Savings summary — intentional goal allocations only */}
              <View style={[S.card, { backgroundColor: C.surface }]}>
                <CardHeader
                  title="Savings Summary"
                  action={activeGoals.length > 0 ? '+ New Goal' : undefined}
                  onAction={() => router.push('/modals/add-goal')}
                />
                <View style={S.savingsSummaryGrid}>
                  <SavingsStat
                    label="In Goals"
                    value={formatCurrency(totalInGoals, currency)}
                    color={C.success}
                    sub="Total saved"
                  />
                  <SavingsStat
                    label="Available"
                    value={formatCurrency(Math.max(available, 0), currency)}
                    color={available >= 0 ? C.primary : C.danger}
                    sub={available >= 0 ? 'To allocate' : 'Over budget'}
                  />
                </View>

                {(totalInGoals > 0 || allActive.length > 0) && (
                  <View style={S.savingsRateBar}>
                    <Text style={[S.cap, { color: C.textTertiary }]}>
                      {allActive.length > 0
                        ? `${allActive.length} active goal${allActive.length > 1 ? 's' : ''} · ${formatCurrency(totalInGoals, currency)} saved so far`
                        : 'No active goals — set one to start saving intentionally'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Savings Goals */}
              {activeGoals.length > 0 ? (
                <View style={[S.card, { backgroundColor: C.surface }]}>
                  <CardHeader
                    title="Savings Goals"
                    action="+ New"
                    onAction={() => router.push('/modals/add-goal')}
                  />
                  <View style={{ gap: Spacing[3] }}>
                    {activeGoals.map(goal => {
                      const pct = goal.target_amount > 0
                        ? Math.min(goal.current_amount / goal.target_amount * 100, 100)
                        : 0;
                      return (
                        <View
                          key={goal.id}
                          style={[S.goalCard, { backgroundColor: goal.color + '0C', borderColor: goal.color + '28' }]}
                        >
                          <View style={S.goalTopRow}>
                            <View style={[S.goalIconBox, { backgroundColor: goal.color + '20' }]}>
                              <Text style={S.goalIconText}>{goal.icon}</Text>
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={[S.labelBody, { color: C.textPrimary }]} numberOfLines={1}>{goal.name}</Text>
                              <Text style={[S.cap, { color: C.textTertiary }]}>
                                {formatCurrency(goal.current_amount, currency)} of {formatCurrency(goal.target_amount, currency)}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: Spacing[1.5] }}>
                              <Text style={[S.capBold, { color: goal.color, fontSize: 14 }]}>{pct.toFixed(0)}%</Text>
                              <TouchableOpacity
                                onPress={() => router.push(`/modals/add-goal?id=${goal.id}` as any)}
                                style={[S.goalEditBtn, { backgroundColor: C.surfaceRaised }]}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                <Text style={S.goalEditBtnText}>✏️</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          <ProgressBar progress={pct} color={goal.color} height={5} animated />
                          <Text style={[S.cap, { color: C.textTertiary }]}>
                            {formatCurrency(Math.max(goal.target_amount - goal.current_amount, 0), currency)} remaining
                          </Text>
                        </View>
                      );
                    })}
                    {allActive.length > 3 && (
                      <TouchableOpacity onPress={() => router.push('/(tabs)/goals')} style={{ alignItems: 'center' }}>
                        <Text style={[S.linkBtn, { color: C.primary }]}>+{allActive.length - 3} more goals →</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push('/modals/add-goal')}
                  activeOpacity={0.7}
                  style={[S.dashedCard, { borderColor: C.border, backgroundColor: C.surface }]}
                >
                  <Text style={{ fontSize: 26 }}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.labelBody, { color: C.textPrimary }]}>Set a savings goal</Text>
                    <Text style={[S.cap, { color: C.textTertiary }]}>Vacation, house, emergency fund...</Text>
                  </View>
                  <Text style={[S.labelBody, { color: C.primary }]}>›</Text>
                </TouchableOpacity>
              )}

              {/* Budget performance */}
              {isCurrent && totalBudgeted > 0 && (
                <View style={[S.card, { backgroundColor: C.surface }]}>
                  <CardHeader
                    title="Budget Performance"
                    action="View all →"
                    onAction={() => router.push('/(tabs)/budgets')}
                  />
                  <ProgressBar progress={budgetPct} color={budgetColor} height={8} animated />
                  <View style={S.budgetBlockFooter}>
                    <Text style={[S.cap, { color: C.textTertiary }]}>
                      {budgetPct.toFixed(0)}% of {formatCurrency(totalBudgeted, currency)} used
                    </Text>
                    <Text style={[S.capBold, { color: budgetPct > 90 ? C.danger : C.success }]}>
                      {formatCurrency(Math.max(totalBudgeted - totalSpent, 0), currency)} left
                    </Text>
                  </View>
                  {budgetsWithSpend.slice(0, 3).map((b, idx) => {
                    const bPct2 = b.amount > 0 ? Math.min((b.spent ?? 0) / b.amount * 100, 100) : 0;
                    return (
                      <View key={b.id ?? idx} style={[S.budgetItemRow, { borderTopColor: C.divider }]}>
                        <Text style={[S.cap, { color: C.textSecondary, flex: 1 }]} numberOfLines={1}>
                          {b.category?.icon ?? ''} {b.category?.name ?? 'Budget'}
                        </Text>
                        <View style={[{ width: 80 }]}>
                          <ProgressBar progress={bPct2} color={bPct2 > 90 ? C.danger : C.success} height={4} animated />
                        </View>
                        <Text style={[S.cap, { color: C.textTertiary, minWidth: 32, textAlign: 'right' }]}>
                          {bPct2.toFixed(0)}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

            </View>
          )}

        </Animated.View>

      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/modals/add-transaction')}
        style={[S.fab, { backgroundColor: C.primary }]}
        activeOpacity={0.85}
      >
        <Text style={S.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function HeroStat({
  icon, label, value, color, highlight,
}: { icon: string; label: string; value: string; color: string; highlight: boolean }) {
  return (
    <View style={[S.heroStat, highlight && S.heroStatHighlight]}>
      <Text style={[S.heroStatIcon, { color }]}>{icon}</Text>
      <Text style={[S.heroStatValue, highlight && { fontSize: 15 }]}>{value}</Text>
      <Text style={S.heroStatLabel}>{label}</Text>
    </View>
  );
}

function CardHeader({
  title, action, onAction,
}: { title: string; action?: string; onAction?: () => void }) {
  const C = useTheme();
  return (
    <View style={S.cardHeaderRow}>
      <Text style={[S.cardTitle, { color: C.textPrimary }]}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={[S.linkBtn, { color: C.primary }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  const C = useTheme();
  return (
    <View style={S.legendItem}>
      <View style={[S.legendDot, { backgroundColor: color }]} />
      <Text style={[S.cap, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[S.capBold, { color: C.textPrimary }]}>{value}</Text>
    </View>
  );
}

function IncomeStat({ label, value, color }: { label: string; value: string; color: string }) {
  const C = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={[S.cap, { color: C.textTertiary }]}>{label}</Text>
      <Text style={[S.labelBody, { color, fontWeight: '700', textAlign: 'center' }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function SavingsStat({
  label, value, color, sub,
}: { label: string; value: string; color: string; sub: string }) {
  const C = useTheme();
  return (
    <View style={[S.savingsStatCard, { backgroundColor: color + '0F', borderColor: color + '25' }]}>
      <Text style={[S.cap, { color: C.textTertiary }]}>{label}</Text>
      <Text style={[S.savingsStatValue, { color }]}>{value}</Text>
      <Text style={[S.cap, { color: C.textTertiary }]}>{sub}</Text>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  const C = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: Spacing[8], gap: Spacing[2] }}>
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <Text style={[S.cap, { color: C.textTertiary, textAlign: 'center' }]}>{message}</Text>
    </View>
  );
}

function EmptyCard({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  const C = useTheme();
  return (
    <View style={[S.card, { backgroundColor: C.surface, alignItems: 'center', paddingVertical: Spacing[10] }]}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <Text style={[S.labelBody, { color: C.textSecondary, marginTop: Spacing[3] }]}>{title}</Text>
      <Text style={[S.cap, { color: C.textTertiary, marginTop: Spacing[1], textAlign: 'center' }]}>{sub}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingHorizontal: Spacing[4], paddingTop: Spacing[2], gap: Spacing[4] },

  // ── Shared card ────────────────────────────────────────────────────────────
  card: {
    borderRadius: BorderRadius['2xl'],
    padding:      Spacing[5],
    gap:          Spacing[4],
    ...Shadow.sm,
  },
  hairline:      { height: StyleSheet.hairlineWidth },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Typography
  cardTitle:  { ...Typography.titleSmall, fontWeight: '700' },
  overline:   { fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  labelBody:  { ...Typography.labelLarge },
  cap:        { ...Typography.caption },
  capBold:    { ...Typography.caption, fontWeight: '700' },
  linkBtn:    { ...Typography.caption, fontWeight: '700' },

  // ── Tab content wrapper ────────────────────────────────────────────────────
  tabContent: { gap: Spacing[4] },
  tabSection: { gap: Spacing[4] },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: {
    borderRadius: BorderRadius['2xl'],
    padding:      Spacing[5],
    overflow:     'hidden',
    gap:          Spacing[1],
    ...Shadow.md,
  },
  heroBg1: { position: 'absolute', top: -50, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroBg2: { position: 'absolute', bottom: -50, left: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.04)' },

  heroHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing[3] },
  heroGreeting:  { ...Typography.caption, color: 'rgba(255,255,255,0.6)' },
  heroName:      { ...Typography.titleMedium, color: '#fff', fontWeight: '800' },
  heroActions:   { flexDirection: 'row', gap: Spacing[2] },
  heroIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroIconEmoji: { fontSize: 17 },
  notifBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },

  heroBalanceBlock:  { gap: Spacing[1], marginBottom: Spacing[1] },
  heroBalanceLabel:  { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, color: 'rgba(255,255,255,0.58)' },
  heroBalanceAmt:    { ...Typography.amount, color: '#fff', fontSize: 40, fontWeight: '800' },
  heroSuffixBadge:   { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing[2.5], paddingVertical: 3 },
  heroSuffixText:    { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },

  monthPicker:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[5], marginVertical: Spacing[2] },
  monthChevron: { fontSize: 26, color: 'rgba(255,255,255,0.75)', fontWeight: '300' },
  monthLabel:   { ...Typography.labelLarge, color: '#fff', fontWeight: '700', minWidth: 130, textAlign: 'center' },

  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: Spacing[2], paddingTop: Spacing[3.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  heroStat:         { flex: 1, alignItems: 'center', gap: 3 },
  heroStatHighlight:{ transform: [{ scale: 1.06 }] },
  heroStatIcon:     { fontSize: 13, fontWeight: '700' },
  heroStatValue:    { ...Typography.titleSmall, color: '#fff', fontVariant: ['tabular-nums'] as any, fontWeight: '700', fontSize: 14 },
  heroStatLabel:    { ...Typography.caption, color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  heroStatDivider:  { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: 'rgba(255,255,255,0.18)' },

  // ── Net Balance ────────────────────────────────────────────────────────────
  netRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  netAmt:    { ...Typography.headingMedium, fontWeight: '800', fontVariant: ['tabular-nums'] as any, marginTop: 2 },
  deltaPill: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing[2.5], paddingVertical: Spacing[1], alignSelf: 'flex-start' },
  deltaTxt:  { fontSize: 12, fontWeight: '800' },

  barSection: { gap: Spacing[2.5] },
  triBar:     { height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden' },
  barSeg:     {},
  barLegend:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1.5] },
  legendDot:  { width: 7, height: 7, borderRadius: 3.5 },

  budgetBlock:       { paddingTop: Spacing[4], borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing[2.5] },
  budgetBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetBlockFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetItemRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingTop: Spacing[2.5], borderTopWidth: StyleSheet.hairlineWidth },

  // ── Income tab ─────────────────────────────────────────────────────────────
  incomeSummaryRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  vertDivider:       { width: StyleSheet.hairlineWidth, height: 36 },
  incomeProgressWrap:{ paddingTop: Spacing[3.5], borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing[2] },

  // ── Categories ─────────────────────────────────────────────────────────────
  catRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  catIconBox: { width: 44, height: 44, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catIconText:{ fontSize: 21 },
  catContent: { flex: 1, gap: Spacing[2] },
  catTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing[2] },
  pctBadge:   { paddingHorizontal: Spacing[2], paddingVertical: Spacing[0.5], borderRadius: BorderRadius.full, flexShrink: 0, minWidth: 40, alignItems: 'center' },
  pctText:    { fontSize: 11, fontWeight: '800' },

  // ── Bills ──────────────────────────────────────────────────────────────────
  billsTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  totalPill:    { borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1.5] },
  totalPillText:{ fontSize: 12, fontWeight: '800' },
  billRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3.5] },
  billIconBox:  { width: 40, height: 40, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  billIconText: { fontSize: 18 },
  billFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing[3.5], borderTopWidth: StyleSheet.hairlineWidth },
  dashedCard:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], borderRadius: BorderRadius.xl, padding: Spacing[4], borderWidth: 1, borderStyle: 'dashed' },

  // ── Goals ──────────────────────────────────────────────────────────────────
  goalCard:      { borderRadius: BorderRadius.xl, padding: Spacing[4], borderWidth: 1, gap: Spacing[2.5] },
  goalTopRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  goalIconBox:   { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  goalIconText:  { fontSize: 21 },
  goalEditBtn:     { width: 28, height: 28, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  goalEditBtnText: { fontSize: 13 },

  // ── Saved tab ──────────────────────────────────────────────────────────────
  savingsSummaryGrid: { flexDirection: 'row', gap: Spacing[3] },
  savingsStatCard:    { flex: 1, borderRadius: BorderRadius.xl, padding: Spacing[3.5], borderWidth: 1, gap: 3, alignItems: 'center' },
  savingsStatValue:   { ...Typography.headingSmall, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  savingsRateBar:     { gap: Spacing[1.5] },

  // ── Transactions ───────────────────────────────────────────────────────────
  txCard: { borderRadius: BorderRadius['2xl'], overflow: 'hidden', ...Shadow.sm },
  txRow:  { paddingHorizontal: Spacing[4], paddingVertical: Spacing[0.5] },

  // ── FAB ────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute', bottom: 100, right: Spacing[5],
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 34 },
});
