/**
 * Dashboard — Home Screen (Waddl redesign)
 *
 * Flat header · Dark-green hero balance card · Mini stat cards
 * Budgets this month section · Recent transactions section
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router }         from 'expo-router';
import { format } from 'date-fns';
import { getBudgetMonthKey, getExpenseBudgetContributions } from '../../src/utils/budgetMonth';

import { useAuthStore }         from '../../src/stores/authStore';
import { useTransactionStore }  from '../../src/stores/transactionStore';
import { useBudgetStore }       from '../../src/stores/budgetStore';
import { useGoalStore }         from '../../src/stores/goalStore';
import { useRecurringStore }    from '../../src/stores/recurringStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { useTheme }             from '../../src/theme/ThemeContext';
import { Typography, FontFamily } from '../../src/theme/typography';
import { Shadow } from '../../src/theme/spacing';

import { ProgressBar }  from '../../src/components/ui/ProgressBar';
import { generateSmartInsights } from '../../src/services/insightEngine';
import { formatCurrency }        from '../../src/utils/currency';
import { CATEGORY_ICON }         from '../../src/lib/icons';

import {
  Bell, Plus, Sparkles, TrendingUp, Package, Pencil, Trash2, Wallet,
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

function greeting(t: (key: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t('home.goodMorning');
  if (h < 17) return t('home.goodAfternoon');
  return t('home.goodEvening');
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
  const { t } = useTranslation();
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
          {tx.note || cat?.name || t('home.transaction')}
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
  const { t } = useTranslation();
  const { profile, user }                               = useAuthStore();
  const { transactions, syncFromServer, loadFromCache, categories } = useTransactionStore();
  const { budgets, loadBudgets, removeBudget } = useBudgetStore();
  const { goals, loadGoals }                            = useGoalStore();
  const { items: recurring, load: loadRecurring }       = useRecurringStore();
  const { prefs, insights, setInsights, load: loadPrefs } = useNotificationStore();
  const [refreshing, setRefreshing]       = useState(false);

  // ── Month selector (for selected-month stats) ────────────────────────────
  const [sel] = useState({ month: MONTH, year: YEAR });

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

  // ── Current-month transaction totals ─────────────────────────────────────
  const curMonthKey = format(NOW, 'yyyy-MM');

  // Budget-month income: income attributed to THIS month via budget_month tag.
  // Early-received next-month salary is intentionally EXCLUDED.
  const curIncome = useMemo(() =>
    transactions
      .filter(t => t.type === 'income' && getBudgetMonthKey(t) === curMonthKey)
      .reduce((s, t) => s + Number(t.amount), 0),
    [transactions]);

  // Budget-month expenses: uses getExpenseBudgetContributions so that
  // - obligation_month tags route pre-paid June obligations away from May, AND
  // - budget_split tags correctly apportion over-budget expenses (the overflow
  //   goes to the future month, keeping the current month from going negative).
  const curSpend = useMemo(() => {
    let total = 0;
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      total += getExpenseBudgetContributions(t)[curMonthKey] ?? 0;
    }
    return total;
  }, [transactions, curMonthKey]);

  // Monthly budget balance (this month's attributed income minus this month's expenses)
  const monthBudgetBalance = curIncome - curSpend;

  // All-time cash balance = every income received − every expense paid (real money in hand)
  const cashBalance = useMemo(() => {
    let bal = 0;
    for (const t of transactions) {
      if (t.type === 'income') bal += Number(t.amount);
      else bal -= Number(t.amount);
    }
    return bal;
  }, [transactions]);

  // ── Per future-budget-month breakdown ────────────────────────────────────
  // Computes the NET budget (income − pre-paid obligations) for every month
  // after the current one.  Both income and expenses are bucketed by their
  // budget-month attribution (tag or date), NOT their transaction date.
  // Each bucket is capped at the actual cash balance so nothing misleading shows.
  const futureBudgetMonths = useMemo(() => {
    const netByKey = new Map<string, number>();
    for (const t of transactions) {
      if (t.type === 'income') {
        const key = getBudgetMonthKey(t);
        if (key <= curMonthKey) continue;
        netByKey.set(key, (netByKey.get(key) ?? 0) + Number(t.amount));
      } else if (t.type === 'expense') {
        // Each contribution key may span the current month AND future months
        // (split expenses have two keys: primary month + overflow month).
        for (const [key, amount] of Object.entries(getExpenseBudgetContributions(t))) {
          if (key <= curMonthKey) continue;
          netByKey.set(key, (netByKey.get(key) ?? 0) - amount);
        }
      }
    }
    const available = Math.max(cashBalance, 0);
    return Array.from(netByKey.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, net]) => ({
        key,
        label: (() => { try { return format(new Date(key + '-01'), 'MMMM'); } catch { return key; } })(),
        net: Math.min(Math.max(net, 0), available),  // cap at real available cash
      }))
      .filter(m => m.net > 0);
  }, [transactions, curMonthKey, cashBalance]);

  // "available" used by insight engine stays as cash balance
  const available     = cashBalance;
  // Spent this month = actual expense transactions only
  const totalSpentCur = curSpend;
  // True savings = intentional goal allocations only
  const totalInGoals   = useMemo(
    () => goals.reduce((s, g) => s + Number(g.current_amount), 0),
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
      .reduce((s, t) => s + Number(t.amount), 0),
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
  const recentTransactions = useMemo(() =>
    [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6),
    [transactions]);

  // Hero balance = actual cash balance (all-time income received − expenses paid)
  const heroBalance = cashBalance;

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
            <Text style={[S.headerGreeting, { color: C.textSecondary }]}>{greeting(t)}</Text>
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
            <Text style={S.heroLabel}>{t('home.availableCash')}</Text>
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

          {/* This month's budget breakdown — 3-col grid */}
          <View style={S.heroBudgetRow}>
            <Text style={S.heroBudgetMonthLabel}>{format(NOW, 'MMMM')} {t('home.budget')}</Text>
            <View style={S.heroBudgetStatRow}>
              <View style={S.heroBudgetStat}>
                <Text style={S.heroBudgetStatLabel}>{t('home.in')}</Text>
                <Text style={S.heroBudgetStatVal}>{formatCurrency(curIncome, currency)}</Text>
              </View>
              <View style={S.heroBudgetStatDivider} />
              <View style={S.heroBudgetStat}>
                <Text style={S.heroBudgetStatLabel}>{t('home.out')}</Text>
                <Text style={S.heroBudgetStatVal}>{formatCurrency(curSpend, currency)}</Text>
              </View>
              <View style={S.heroBudgetStatDivider} />
              <View style={S.heroBudgetStat}>
                <Text style={S.heroBudgetStatLabel}>
                  {monthBudgetBalance >= 0 ? t('home.left') : t('home.over')}
                </Text>
                <Text style={[S.heroBudgetStatVal, {
                  color: monthBudgetBalance >= 0 ? '#9FE870' : '#FF6B6B',
                }]}>
                  {formatCurrency(Math.abs(monthBudgetBalance), currency)}
                </Text>
              </View>
            </View>
          </View>

          {/* Delta pill */}
          {heroDeltaText && (
            <View style={S.heroDeltaPill}>
              <Text style={[S.heroDeltaText, { color: C.primary }]}>{heroDeltaText}</Text>
            </View>
          )}

          {/* One pill per future budget month — keeps buckets clearly separate */}
          {futureBudgetMonths.map(m => (
            <View key={m.key} style={S.futureReservedPill}>
              <Text style={S.futureReservedText}>
                {formatCurrency(m.net, currency)} · {m.label} {t('home.budget')} · {t('home.receivedEarly')}
              </Text>
            </View>
          ))}

          {/* Quick action chips */}
          <View style={S.heroChips}>
            {[
              { Icon: Plus,        labelKey: 'home.chipAdd',          onPress: () => router.push('/modals/add-transaction') },
              { Icon: TrendingUp,  labelKey: 'home.chipTransactions', onPress: () => router.push('/(tabs)/transactions' as any) },
              { Icon: Sparkles,    labelKey: 'home.chipInsights',     onPress: () => router.push('/(tabs)/budgets') },
              { Icon: Wallet,      labelKey: 'home.chipFinances',     onPress: () => router.push('/(tabs)/goals') },
            ].map(({ Icon, labelKey, onPress }) => (
              <TouchableOpacity
                key={labelKey}
                onPress={onPress}
                style={S.heroChip}
                activeOpacity={0.75}
              >
                <Icon size={18} color="#fff" strokeWidth={2} />
                <Text style={S.heroChipLabel}>{t(labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* ════════ Mini stat cards ════════ */}
        <View style={S.miniCards}>
          {/* This-month budget remaining */}
          {(() => {
            const remaining = monthBudgetBalance;
            const color = remaining >= 0 ? C.success : C.danger;
            return (
              <View style={[S.miniCard, { backgroundColor: C.surface }, Shadow.sm]}>
                <Text style={[S.miniCardLabel, { color: C.textSecondary }]}>
                  {format(NOW, 'MMMM')} {t('home.budget')}
                </Text>
                <Text
                  style={[S.miniCardAmt, { color }]}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  minimumFontScale={0.65}
                >
                  {remaining < 0 ? '−' : ''}{formatCurrency(Math.abs(remaining), currency)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Text style={[S.miniCardDelta, { color: C.textTertiary }]}>
                    {remaining >= 0 ? t('home.remaining') : t('home.overBudget')}
                    {spendDelta !== null && ` · ${spendDelta >= 0 ? '↑' : '↓'}${Math.abs(Math.round(spendDelta))}% ${t('home.spendDelta')}`}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Future-month assigned income (one row per month) or goals if none */}
          {futureBudgetMonths.length > 0 ? (
            <View style={[S.miniCard, { backgroundColor: C.surface }, Shadow.sm]}>
              <Text style={[S.miniCardLabel, { color: C.textSecondary }]}>{t('home.futureBudget')}</Text>
              <Text
                style={[S.miniCardAmt, { color: '#F59E0B' }]}
                adjustsFontSizeToFit
                numberOfLines={1}
                minimumFontScale={0.65}
              >
                {formatCurrency(futureBudgetMonths.reduce((s, m) => s + m.net, 0), currency)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Text style={[S.miniCardDelta, { color: C.textTertiary }]}>
                  {futureBudgetMonths.map(m => m.label).join(' · ')} · {t('home.receivedEarly')}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[S.miniCard, { backgroundColor: C.surface }, Shadow.sm]}>
              <Text style={[S.miniCardLabel, { color: C.textSecondary }]}>{t('home.savedThisMonth')}</Text>
              <Text
                style={[S.miniCardAmt, { color: C.textPrimary }]}
                adjustsFontSizeToFit
                numberOfLines={1}
                minimumFontScale={0.65}
              >
                {formatCurrency(totalInGoals, currency)}
              </Text>
              {allActive.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Text style={[S.miniCardDelta, { color: C.success }]}>
                    {allActive.length} {t('home.activeGoal', { count: allActive.length })}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ════════ My Budgets ════════ */}
        <View style={S.sectionHeader}>
          <Text style={[S.sectionTitle, { color: C.textPrimary }]}>{t('home.myBudgets')}</Text>
          <TouchableOpacity onPress={() => router.push('/modals/add-budget')}>
            <Text style={[S.seeAll, { color: C.primary }]}>{t('home.add')}</Text>
          </TouchableOpacity>
        </View>

        {budgetsWithSpend.length > 0 ? (
          <>
            <View style={[S.listCard, { backgroundColor: C.surface }, Shadow.sm]}>
              {budgetsWithSpend.map((b, i) => {
                const pct      = b.amount > 0 ? Math.min((b.spent ?? 0) / b.amount * 100, 100) : 0;
                const barColor = pct > 90 ? C.danger : pct > 70 ? '#F59E0B' : C.success;
                const cat      = categories.find(c => c.id === b.category_id);
                const IconComp = cat ? (CATEGORY_ICON[cat.name?.toLowerCase()] ?? Package) : Package;
                const catColor = cat?.color ?? C.primary;
                const remaining = b.amount - (b.spent ?? 0);
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
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{cat?.name ?? 'Budget'}</Text>
                        <Text style={{ ...Typography.bodySmall, color: pct > 90 ? C.danger : C.textSecondary }}>
                          {formatCurrency(b.spent ?? 0, currency, { compact: true })} / {formatCurrency(b.amount, currency, { compact: true })}
                        </Text>
                      </View>
                      <ProgressBar progress={pct} color={barColor} height={6} animated />
                      <Text style={{ ...Typography.caption, color: remaining >= 0 ? C.success : C.danger, marginTop: 3 }}>
                        {remaining >= 0
                          ? `${formatCurrency(remaining, currency, { compact: true })} ${t('home.leftShort')}`
                          : `${formatCurrency(Math.abs(remaining), currency, { compact: true })} ${t('home.overShort')}`}
                      </Text>
                    </View>
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
          </>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/modals/add-budget')}
            style={[S.emptyCard, { backgroundColor: C.surface, borderColor: C.border }, Shadow.sm]}
          >
            <Text style={[S.emptyCardText, { color: C.textTertiary }]}>{t('home.noBudgetsYet')}</Text>
          </TouchableOpacity>
        )}

        {/* ════════ Recent Transactions ════════ */}
        <View style={[S.sectionHeader, { marginTop: 24 }]}>
          <Text style={[S.sectionTitle, { color: C.textPrimary }]}>{t('home.recentTransactions')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions' as any)}>
            <Text style={[S.seeAll, { color: C.textSecondary }]}>{t('home.seeAll')}</Text>
          </TouchableOpacity>
        </View>
        {recentTransactions.length > 0 ? (
          <View style={[S.listCard, { backgroundColor: C.surface, marginBottom: 40 }, Shadow.sm]}>
            {recentTransactions.map((tx, i) => (
              <RecentTxRow
                key={tx.id}
                tx={tx}
                C={C}
                currency={currency}
                categories={categories}
                isLast={i === recentTransactions.length - 1}
              />
            ))}
          </View>
        ) : (
          <View style={[S.emptyCard, { backgroundColor: C.surface, borderColor: C.border, marginBottom: 40 }, Shadow.sm]}>
            <Text style={[S.emptyCardText, { color: C.textTertiary }]}>{t('home.noTransactionsYet')}</Text>
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
  heroBudgetRow: {
    marginTop: 10,
  },
  heroBudgetMonthLabel: {
    fontSize: 10, fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroBudgetStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBudgetStat: {
    flex: 1,
  },
  heroBudgetStatLabel: {
    fontSize: 10, fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 2,
  },
  heroBudgetStatVal: {
    fontSize: 13, fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.2,
  },
  heroBudgetStatDivider: {
    width: 1, height: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 10,
  },
  heroDeltaText: {
    fontSize: 13, fontWeight: '600',
  },
  futureReservedPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
  },
  futureReservedText: {
    fontSize: 12, fontWeight: '600', color: '#FCD34D',
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
    fontSize: 22, fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
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
