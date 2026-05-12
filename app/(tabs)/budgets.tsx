/**
 * Insights + AI Budget Plan Screen
 *
 * Tab 1 — Insights: period chart, smart insights, by-category spend
 * Tab 2 — Budget AI: personalised AI-generated monthly budget plan
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuthStore }         from '../../src/stores/authStore';
import { useTransactionStore }  from '../../src/stores/transactionStore';
import { useBudgetStore }       from '../../src/stores/budgetStore';
import { useRecurringStore }    from '../../src/stores/recurringStore';
import { useGoalStore }         from '../../src/stores/goalStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { FinancialChart }       from '../../src/components/dashboard/FinancialChart';
import { ProgressBar }          from '../../src/components/ui/ProgressBar';
import { useTheme }             from '../../src/theme/ThemeContext';
import { Typography, FontFamily } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency }       from '../../src/utils/currency';
import { CATEGORY_ICON }        from '../../src/lib/icons';
import { generateBudgetPlan, BudgetRecommendation, RecStatus, toMonthly } from '../../src/services/budgetAdvisor';
import { Sparkles, Package, TrendingUp, ChevronRight, Pencil, Trash2 } from 'lucide-react-native';

const CAT_META: Record<string, { icon: string; color: string }> = {
  rent:         { icon: '🏠', color: '#6366f1' },
  utilities:    { icon: '💡', color: '#f59e0b' },
  subscription: { icon: '📱', color: '#8b5cf6' },
  debt:         { icon: '💳', color: '#ef4444' },
  insurance:    { icon: '🛡️', color: '#3b82f6' },
  transport:    { icon: '🚗', color: '#10b981' },
  other:        { icon: '📦', color: '#6b7280' },
};

const now   = new Date();
const MONTH = now.getMonth() + 1;
const YEAR  = now.getFullYear();

type Tab    = 'Insights' | 'AI Budget';
type Period = 'Week' | 'Month' | 'Year';

// ─── Status colour helper ─────────────────────────────────────────────────────

function statusColor(status: RecStatus, C: any): string {
  switch (status) {
    case 'excellent': return C.success;
    case 'good':      return C.primary;
    case 'warning':   return '#F59E0B';
    case 'over':      return C.danger;
  }
}

function statusLabel(status: RecStatus): string {
  switch (status) {
    case 'excellent': return 'Excellent';
    case 'good':      return 'On track';
    case 'warning':   return 'Over slightly';
    case 'over':      return 'Over budget';
  }
}

// ─── AI Recommendation Card ───────────────────────────────────────────────────

function RecCard({
  rec, currency, C, isLast,
}: {
  rec: BudgetRecommendation; currency: string; C: any; isLast: boolean;
}) {
  const pct       = rec.recommendedAmount > 0
    ? Math.min((rec.currentSpend / rec.recommendedAmount) * 100, 100)
    : 0;
  const barColor  = statusColor(rec.status, C);
  const overBy    = rec.currentSpend - rec.recommendedAmount;
  const hasSpend  = rec.currentSpend > 0;

  return (
    <View style={[
      styles.recCard,
      { backgroundColor: C.surface },
      !isLast && { marginBottom: 10 },
      Shadow.sm,
    ]}>
      {/* Header row */}
      <View style={styles.recHeader}>
        <View style={[styles.recIconBox, { backgroundColor: rec.color + '18' }]}>
          <Text style={styles.recIcon}>{rec.icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.recTitleRow}>
            <Text style={[styles.recName, { color: C.textPrimary }]}>{rec.categoryName}</Text>
            {/* Status pill */}
            <View style={[styles.statusPill, { backgroundColor: barColor + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: barColor }]} />
              <Text style={[styles.statusText, { color: barColor }]}>{statusLabel(rec.status)}</Text>
            </View>
          </View>
          <Text style={[styles.recReason, { color: C.textTertiary }]} numberOfLines={1}>
            {rec.reason}
          </Text>
        </View>
      </View>

      {/* Amounts */}
      <View style={styles.recAmounts}>
        <View style={styles.recAmountCol}>
          <Text style={[styles.recAmtLabel, { color: C.textTertiary }]}>Recommended</Text>
          <Text style={[styles.recAmtValue, { color: C.textPrimary }]}>
            {formatCurrency(rec.recommendedAmount, currency)}
          </Text>
        </View>
        <View style={[styles.recDivider, { backgroundColor: C.border }]} />
        <View style={styles.recAmountCol}>
          <Text style={[styles.recAmtLabel, { color: C.textTertiary }]}>Spent so far</Text>
          <Text style={[styles.recAmtValue, { color: hasSpend ? (rec.status === 'over' ? C.danger : C.textPrimary) : C.textTertiary }]}>
            {hasSpend ? formatCurrency(rec.currentSpend, currency) : '—'}
          </Text>
        </View>
        {overBy > 0 && (
          <>
            <View style={[styles.recDivider, { backgroundColor: C.border }]} />
            <View style={styles.recAmountCol}>
              <Text style={[styles.recAmtLabel, { color: C.textTertiary }]}>Over by</Text>
              <Text style={[styles.recAmtValue, { color: C.danger }]}>
                +{formatCurrency(overBy, currency)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Progress bar */}
      {hasSpend && (
        <View style={{ gap: 6, marginTop: 4 }}>
          <ProgressBar progress={pct} color={barColor} height={6} animated />
          <Text style={[styles.recTip, { color: C.textTertiary }]}>{rec.tip}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Health Score Ring ────────────────────────────────────────────────────────

function HealthScore({ score, C }: { score: number; C: any }) {
  const color = score >= 80 ? C.success : score >= 55 ? '#F59E0B' : C.danger;
  const label = score >= 80 ? 'Healthy' : score >= 55 ? 'Fair' : 'Needs work';

  return (
    <View style={styles.healthScoreBox}>
      <View style={[styles.healthRing, { borderColor: color + '40' }]}>
        <View style={[styles.healthRingInner, { backgroundColor: color + '18' }]}>
          <Text style={[styles.healthNumber, { color }]}>{score}</Text>
          <Text style={[styles.healthDenom, { color: C.textTertiary }]}>/100</Text>
        </View>
      </View>
      <Text style={[styles.healthLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const C = useTheme();
  const { user, profile }                              = useAuthStore();
  const { transactions, categories }                   = useTransactionStore();
  const { budgets, loadBudgets, removeBudget, savingsTargetPct, loadSavingsPct, setSavingsTargetPct } = useBudgetStore();
  const { items: recurring, load: loadRecurring }      = useRecurringStore();
  const { goals, loadGoals }                           = useGoalStore();
  const { insights }                                   = useNotificationStore();
  const [refreshing, setRefreshing]                    = useState(false);
  const [activeTab, setActiveTab]                      = useState<Tab>('Insights');
  const [period, setPeriod]                            = useState<Period>('Month');
  const [expandedKey, setExpandedKey]                  = useState<string | null>(null);

  const currency = profile?.currency ?? 'MYR';

  useEffect(() => {
    if (user) {
      loadBudgets(user.id, MONTH, YEAR);
      loadRecurring();
      loadGoals(user.id);
    }
    loadSavingsPct();
  }, [user?.id]);

  // ── Insights tab data ─────────────────────────────────────────────────────
  const netChange = useMemo(() => {
    let net = 0;
    for (const t of transactions) {
      if (t.type === 'income') net += t.amount;
      else net -= t.amount;
    }
    return net;
  }, [transactions]);

  const selStats = useMemo(
    () => useTransactionStore.getState().getMonthlyStats(MONTH, YEAR),
    [transactions],
  );
  const topCats = selStats.byCategory.slice(0, 6);

  const budgetsWithSpend = useMemo(() => budgets.map(b => ({
    ...b,
    spent: transactions
      .filter(t =>
        t.type === 'expense' && t.category_id === b.category_id &&
        new Date(t.date).getMonth() + 1 === MONTH && new Date(t.date).getFullYear() === YEAR,
      )
      .reduce((s, t) => s + t.amount, 0),
  })), [budgets, transactions]);

  // ── AI Budget Plan ────────────────────────────────────────────────────────
  const plan = useMemo(() => generateBudgetPlan({
    transactions,
    recurring,
    goals,
    categories,
    savingsOverridePct: savingsTargetPct,
  }), [transactions, recurring, goals, categories, savingsTargetPct]);

  // Group recommendations by priority
  const savingsRec    = plan.recommendations.filter(r => r.priority === 'savings');
  const essentialRecs = plan.recommendations.filter(r => r.priority === 'essential');
  const lifestyleRecs = plan.recommendations.filter(r => r.priority === 'lifestyle');

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await loadBudgets(user.id, MONTH, YEAR);
    setRefreshing(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: C.textPrimary }]}>Insights</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>Where your money's going.</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/modals/add-budget')}
          style={[styles.addBudgetBtn, { backgroundColor: C.primaryLight }]}
        >
          <Text style={[styles.addBudgetText, { color: C.primary }]}>+ Budget</Text>
        </TouchableOpacity>
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabBar, { backgroundColor: C.surfaceRaised }]}>
        {(['Insights', 'AI Budget'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              activeTab === tab && [styles.tabBtnActive, { backgroundColor: C.surface }, Shadow.sm],
            ]}
          >
            {tab === 'AI Budget' && (
              <Sparkles size={13} color={activeTab === tab ? C.primary : C.textTertiary} strokeWidth={2} />
            )}
            <Text style={[
              styles.tabLabel,
              { color: activeTab === tab ? C.textPrimary : C.textTertiary },
              activeTab === tab && { fontWeight: '700' },
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {activeTab === 'Insights' ? (
          /* ══════════ INSIGHTS TAB ══════════ */
          <>
            {/* Period segmented control */}
            <View style={[styles.segmented, { backgroundColor: C.surfaceRaised }]}>
              {(['Week', 'Month', 'Year'] as Period[]).map(p => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={[
                    styles.segBtn,
                    period === p && [styles.segBtnActive, { backgroundColor: C.surface }, Shadow.sm],
                  ]}
                >
                  <Text style={[
                    styles.segLabel,
                    { color: period === p ? C.textPrimary : C.textTertiary },
                    period === p && { fontWeight: '700' },
                  ]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Net change card */}
            <View style={[styles.card, { backgroundColor: C.surface }, Shadow.sm]}>
              <Text style={[styles.cardSub, { color: C.textSecondary }]}>Net change · last 12 months</Text>
              <Text style={[styles.netAmt, { color: netChange >= 0 ? C.textPrimary : C.danger }]}>
                {netChange < 0 ? '−' : ''}{formatCurrency(Math.abs(netChange), currency)}
              </Text>
              <FinancialChart
                transactions={transactions}
                recurring={recurring}
                currency={currency}
              />
            </View>

            {/* Smart insights */}
            {insights.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Smart insights</Text>
                </View>
                <View style={styles.insightsList}>
                  {insights.slice(0, 4).map((insight, i) => (
                    <View key={i} style={[styles.insightCard, { backgroundColor: C.surface }, Shadow.sm]}>
                      <View style={[styles.insightIconBox, { backgroundColor: C.primaryLight }]}>
                        <Text style={styles.insightIcon}>{insight.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{insight.title}</Text>
                        <Text style={{ ...Typography.bodySmall, color: C.textSecondary, marginTop: 2 }}>{insight.message}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* By category */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>By category</Text>
              <Text style={[styles.sectionSub, { color: C.textSecondary }]}>This month</Text>
            </View>
            {topCats.length > 0 ? (
              <View style={[styles.listCard, { backgroundColor: C.surface }, Shadow.sm]}>
                {topCats.map(({ category, amount, percentage }, i) => {
                  const IconComp = CATEGORY_ICON[category.name?.toLowerCase()] ?? Package;
                  return (
                    <View
                      key={category.id}
                      style={[
                        styles.catRow,
                        i < topCats.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
                      ]}
                    >
                      <View style={[styles.catIconBox, { backgroundColor: (category.color ?? C.primary) + '20' }]}>
                        <IconComp size={20} color={category.color ?? C.primary} strokeWidth={2.25} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{category.name}</Text>
                          <Text style={{ ...Typography.bodySmall, color: C.textSecondary }}>
                            {formatCurrency(amount, currency)}
                          </Text>
                        </View>
                        <ProgressBar progress={percentage} color={category.color ?? C.primary} height={5} animated />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: C.surface, borderColor: C.border }, Shadow.sm]}>
                <Text style={[styles.emptyText, { color: C.textTertiary }]}>No expenses this month yet</Text>
              </View>
            )}

            {/* My budgets */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>My budgets</Text>
              <TouchableOpacity onPress={() => router.push('/modals/add-budget')}>
                <Text style={[styles.sectionSub, { color: C.primary }]}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {budgetsWithSpend.length > 0 ? (
              <View style={[styles.listCard, { backgroundColor: C.surface }, Shadow.sm]}>
                {budgetsWithSpend.map((b, i) => {
                  const pct      = b.amount > 0 ? Math.min((b.spent ?? 0) / b.amount * 100, 100) : 0;
                  const barColor = pct > 90 ? C.danger : pct > 70 ? '#F59E0B' : C.success;
                  const cat      = categories.find(c => c.id === b.category_id);
                  const IconComp = cat ? (CATEGORY_ICON[cat.name?.toLowerCase()] ?? Package) : Package;
                  return (
                    <View
                      key={b.id}
                      style={[
                        styles.budgetItemRow,
                        i < budgetsWithSpend.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
                      ]}
                    >
                      <View style={[styles.catIconBox, { backgroundColor: (cat?.color ?? C.primary) + '20' }]}>
                        <IconComp size={20} color={cat?.color ?? C.primary} strokeWidth={2.25} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{cat?.name ?? 'Budget'}</Text>
                          <Text style={{ ...Typography.bodySmall, color: pct > 90 ? C.danger : C.textSecondary }}>
                            {formatCurrency(b.spent ?? 0, currency, { compact: true })} / {formatCurrency(b.amount, currency, { compact: true })}
                          </Text>
                        </View>
                        <ProgressBar progress={pct} color={barColor} height={6} animated />
                      </View>
                      {/* Edit + Delete */}
                      <View style={styles.budgetItemActions}>
                        <TouchableOpacity
                          onPress={() => router.push(`/modals/add-budget?id=${b.id}` as any)}
                          style={[styles.budgetActionBtn, { backgroundColor: C.primaryLight }]}
                        >
                          <Pencil size={13} color={C.primary} strokeWidth={2.5} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => b.id && removeBudget(b.id)}
                          style={[styles.budgetActionBtn, { backgroundColor: C.dangerLight }]}
                        >
                          <Trash2 size={13} color={C.danger} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/modals/add-budget')}
                style={[styles.emptyCard, { backgroundColor: C.surface, borderColor: C.border }, Shadow.sm]}
              >
                <Text style={[styles.emptyText, { color: C.textTertiary }]}>No personal budgets yet — tap to add one</Text>
              </TouchableOpacity>
            )}

            {/* Fixed obligations */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Fixed Obligations</Text>
              <TouchableOpacity onPress={() => router.push('/modals/add-recurring')}>
                <Text style={[styles.sectionSub, { color: C.primary }]}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {recurring.length === 0 ? (
              <TouchableOpacity
                onPress={() => router.push('/modals/add-recurring')}
                style={[styles.emptyCard, { backgroundColor: C.surface, borderColor: C.border }, Shadow.sm]}
              >
                <Text style={[styles.emptyText, { color: C.textTertiary }]}>No fixed bills yet — tap to add rent, subscriptions, debt</Text>
              </TouchableOpacity>
            ) : (
              <>
                {/* Summary pill — standalone card */}
                <View style={[styles.obligationSummaryCard, { backgroundColor: C.surface }, Shadow.sm]}>
                  <View style={[styles.obligationSummaryLeft, { backgroundColor: C.dangerLight }]}>
                    <Text style={[styles.obligationTotalLabel, { color: C.textTertiary }]}>TOTAL / MONTH</Text>
                    <Text style={[styles.obligationTotalAmt, { color: C.danger }]}>
                      {formatCurrency(recurring.reduce((s, r) => s + toMonthly(r.amount, r.frequency), 0), currency)}
                    </Text>
                  </View>
                  <View style={styles.obligationSummaryRight}>
                    <Text style={[styles.obligationCountBig, { color: C.textPrimary }]}>{recurring.length}</Text>
                    <Text style={[styles.obligationCountLabel, { color: C.textTertiary }]}>
                      {recurring.length === 1 ? 'obligation' : 'obligations'}
                    </Text>
                  </View>
                </View>

                {/* Items list — visually separate card */}
                <View style={[styles.listCard, { backgroundColor: C.surface }, Shadow.sm]}>
                  {recurring.map((item, i) => {
                    const meta    = CAT_META[item.category] ?? CAT_META.other;
                    const monthly = toMonthly(item.amount, item.frequency);
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.obligationRow,
                          i < recurring.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
                        ]}
                      >
                        <View style={[styles.catIconBox, { backgroundColor: meta.color + '20' }]}>
                          <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{item.name}</Text>
                          <Text style={{ ...Typography.caption, color: C.textTertiary, marginTop: 2 }}>
                            {item.frequency === 'monthly' ? 'Monthly' : item.frequency === 'weekly' ? 'Weekly' : 'Yearly'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ ...Typography.labelLarge, color: C.textPrimary }}>
                            {formatCurrency(item.amount, currency)}
                          </Text>
                          {item.frequency !== 'monthly' && (
                            <Text style={{ ...Typography.caption, color: C.textTertiary }}>
                              {formatCurrency(monthly, currency)}/mo
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        ) : (
          /* ══════════ AI BUDGET TAB ══════════ */
          <>
            {/* Coach summary card */}
            <View style={[styles.coachCard, { backgroundColor: '#0E2417' }, Shadow.sm]}>
              {/* Glow blob */}
              <View style={styles.coachBg} />

              <View style={styles.coachTop}>
                <View style={[styles.coachIconBox, { backgroundColor: 'rgba(159,232,112,0.15)' }]}>
                  <Sparkles size={20} color='#9FE870' strokeWidth={2} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.coachLabel}>AI Budget Coach</Text>
                  <Text style={styles.coachSummary} numberOfLines={2}>{plan.summary}</Text>
                </View>
                <HealthScore score={plan.healthScore} C={C} />
              </View>

              <Text style={styles.coachMessage}>{plan.coachMessage}</Text>

              {/* Quick stat pills */}
              {plan.monthlyIncome > 0 && (
                <View style={styles.coachPills}>
                  {[
                    { label: 'Income',     value: formatCurrency(plan.monthlyIncome, currency, { compact: true }),    color: '#9FE870' },
                    { label: 'Essentials', value: formatCurrency(plan.essentialsTotal, currency, { compact: true }),  color: '#60A5FA' },
                    { label: 'Lifestyle',  value: formatCurrency(plan.lifestyleTotal, currency, { compact: true }),   color: '#C084FC' },
                    { label: 'Save target', value: formatCurrency(plan.savingsTarget, currency, { compact: true }),    color: '#34D399' },
                  ].map(({ label, value, color }) => (
                    <View key={label} style={styles.coachPill}>
                      <Text style={[styles.coachPillValue, { color }]}>{value}</Text>
                      <Text style={styles.coachPillLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* No income state */}
            {plan.monthlyIncome === 0 && (
              <TouchableOpacity
                onPress={() => router.push('/modals/add-transaction')}
                style={[styles.noIncomeCard, { backgroundColor: C.surface, borderColor: C.border }, Shadow.sm]}
              >
                <TrendingUp size={28} color={C.primary} strokeWidth={2} />
                <Text style={[styles.noIncomeTitle, { color: C.textPrimary }]}>Add your income first</Text>
                <Text style={[styles.noIncomeSub, { color: C.textSecondary }]}>
                  Log at least one income transaction so I can build your personalised budget plan.
                </Text>
                <View style={[styles.noIncomeBtn, { backgroundColor: C.primary }]}>
                  <Text style={[styles.noIncomeBtnText, { color: '#0E2417' }]}>+ Add Income</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Savings target */}
            {savingsRec.length > 0 && (
              <View style={{ marginHorizontal: 16, marginTop: 16 }}>
                <Text style={[styles.groupLabel, { color: C.textSecondary }]}>💰 Savings target</Text>

                {/* % selector chips */}
                <View style={[styles.savingsPctCard, { backgroundColor: C.surface }, Shadow.sm]}>
                  <View style={styles.savingsPctHeader}>
                    <Text style={[styles.savingsPctTitle, { color: C.textPrimary }]}>
                      How much of your income to save?
                    </Text>
                    <Text style={[styles.savingsPctCurrent, { color: C.primary }]}>
                      {savingsTargetPct}%
                    </Text>
                  </View>
                  <View style={styles.savingsPctChips}>
                    {[5, 10, 15, 20, 25, 30].map(pct => {
                      const selected = savingsTargetPct === pct;
                      return (
                        <TouchableOpacity
                          key={pct}
                          onPress={() => setSavingsTargetPct(pct)}
                          style={[
                            styles.savingsPctChip,
                            selected
                              ? { backgroundColor: C.primary }
                              : { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 },
                          ]}
                          activeOpacity={0.75}
                        >
                          <Text style={[
                            styles.savingsPctChipText,
                            { color: selected ? '#0E2417' : C.textSecondary },
                          ]}>
                            {pct}%
                          </Text>
                          {plan.monthlyIncome > 0 && (
                            <Text style={[
                              styles.savingsPctChipAmt,
                              { color: selected ? '#0E2417' : C.textTertiary },
                            ]}>
                              {formatCurrency(plan.monthlyIncome * pct / 100, currency, { compact: true })}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <RecCard rec={savingsRec[0]} currency={currency} C={C} isLast />
              </View>
            )}

            {/* Essentials */}
            {essentialRecs.length > 0 && (
              <View style={{ marginHorizontal: 16, marginTop: 20 }}>
                <Text style={[styles.groupLabel, { color: C.textSecondary }]}>🧱 Essentials (50%)</Text>
                {essentialRecs.map((rec, i) => (
                  <RecCard key={rec.id} rec={rec} currency={currency} C={C} isLast={i === essentialRecs.length - 1} />
                ))}
              </View>
            )}

            {/* Lifestyle */}
            {lifestyleRecs.length > 0 && (
              <View style={{ marginHorizontal: 16, marginTop: 20 }}>
                <Text style={[styles.groupLabel, { color: C.textSecondary }]}>🎯 Lifestyle (30%)</Text>
                {lifestyleRecs.map((rec, i) => (
                  <RecCard key={rec.id} rec={rec} currency={currency} C={C} isLast={i === lifestyleRecs.length - 1} />
                ))}
              </View>
            )}

            {/* Set custom budgets CTA */}
            <TouchableOpacity
              onPress={() => router.push('/modals/add-budget')}
              style={[styles.ctaCard, { backgroundColor: C.surface, borderColor: C.primaryLight }, Shadow.sm]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: C.textPrimary }]}>Set custom budget limits</Text>
                <Text style={[styles.ctaSub, { color: C.textSecondary }]}>
                  Override AI recommendations with your own limits for any category.
                </Text>
              </View>
              <ChevronRight size={18} color={C.primary} strokeWidth={2} />
            </TouchableOpacity>

            {/* Disclaimer */}
            <Text style={[styles.disclaimer, { color: C.textTertiary }]}>
              Recommendations are generated from your last 3 months of data using a 50/30/20 framework blended with your personal spending history.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 4,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 32, fontWeight: '800',
  },
  subtitle: { fontSize: 15, marginTop: 4 },
  addBudgetBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  addBudgetText: { ...Typography.labelSmall, fontWeight: '700' },

  // Tab switcher (top)
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12, padding: 4,
    marginHorizontal: 24, marginTop: 16, marginBottom: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row',
    paddingVertical: 8, alignItems: 'center',
    justifyContent: 'center', borderRadius: 8, gap: 5,
  },
  tabBtnActive: { borderRadius: 8 },
  tabLabel:     { fontSize: 13, fontWeight: '600' },

  // Segmented control (Insights sub-period)
  segmented: {
    flexDirection: 'row', borderRadius: 12, padding: 4,
    marginHorizontal: 24, marginTop: 12,
  },
  segBtn:       { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segBtnActive: { borderRadius: 8 },
  segLabel:     { fontSize: 13, fontWeight: '600' },

  // Net change card
  card: {
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 20, padding: 20, gap: 4,
  },
  cardSub: { fontSize: 13 },
  netAmt: {
    fontFamily: FontFamily.display,
    fontSize: 34, fontWeight: '800',
    letterSpacing: -0.5, marginTop: 4,
  },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, marginTop: 24, marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.display, fontSize: 18, fontWeight: '700',
  },
  sectionSub: { fontSize: 15 },

  insightsList: { gap: 8, marginHorizontal: 16 },
  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 20, padding: 16, gap: 12,
  },
  insightIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  insightIcon: { fontSize: 20 },

  listCard: { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
  catRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
  },
  catIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  emptyCard: {
    marginHorizontal: 16, borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14 },

  // Fixed obligations
  obligationSummaryCard: {
    marginHorizontal: 16, borderRadius: 20,
    flexDirection: 'row', overflow: 'hidden',
  },
  obligationSummaryLeft: {
    flex: 1, padding: 16, gap: 3,
  },
  obligationSummaryRight: {
    paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
  },
  obligationTotalLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  obligationTotalAmt:   { fontSize: 22, fontWeight: '800', marginTop: 2 },
  obligationCountBig:   { fontSize: 28, fontWeight: '800' },
  obligationCountLabel: { fontSize: 11, fontWeight: '600' },
  obligationCount:      { fontSize: 13 },
  obligationRow:        { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },

  // Budget item with actions
  budgetItemRow:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  budgetItemActions:{ flexDirection: 'row', gap: 6 },
  budgetActionBtn:  { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  // ── AI Budget tab ──────────────────────────────────────────────────────────

  // Coach hero card
  coachCard: {
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 24, padding: 20,
    overflow: 'hidden', gap: 14,
  },
  coachBg: {
    position: 'absolute', top: -60, right: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(159,232,112,0.06)',
  },
  coachTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  coachIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  coachLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
  },
  coachSummary: {
    fontSize: 15, fontWeight: '600', color: '#fff', lineHeight: 20,
  },
  coachMessage: {
    fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 21,
  },
  coachPills: {
    flexDirection: 'row', gap: 6,
  },
  coachPill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, padding: 10, alignItems: 'center', gap: 2,
  },
  coachPillValue: { fontSize: 14, fontWeight: '700' },
  coachPillLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },

  // Health score ring
  healthScoreBox: { alignItems: 'center', gap: 3 },
  healthRing: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  healthRingInner: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column',
  },
  healthNumber: { fontSize: 17, fontWeight: '800', lineHeight: 20 },
  healthDenom:  { fontSize: 9,  fontWeight: '600', lineHeight: 11, opacity: 0.6 },
  healthLabel:  { fontSize: 9,  fontWeight: '700' },

  // No income CTA
  noIncomeCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20,
    padding: 24, alignItems: 'center', gap: 10, borderWidth: 1.5,
  },
  noIncomeTitle: { ...Typography.titleMedium, textAlign: 'center' },
  noIncomeSub:   { ...Typography.bodySmall, textAlign: 'center', lineHeight: 20 },
  noIncomeBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: BorderRadius.full, marginTop: 4,
  },
  noIncomeBtnText: { fontWeight: '700', fontSize: 14 },

  // Group label
  groupLabel: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.5,
    marginBottom: 10, textTransform: 'uppercase',
  },

  // Recommendation card
  recCard: {
    borderRadius: 20, padding: 16, gap: 12,
  },
  recHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  recIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  recIcon:     { fontSize: 20 },
  recTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  recName:     { ...Typography.titleSmall },
  recReason:   { fontSize: 12, marginTop: 2 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
  },
  statusDot:  { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  recAmounts: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 12,
  },
  recAmountCol: { flex: 1, alignItems: 'center', gap: 3 },
  recAmtLabel:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  recAmtValue:  { ...Typography.titleSmall, fontWeight: '700' },
  recDivider:   { width: 1, height: 28 },
  recTip:       { fontSize: 12, lineHeight: 16 },

  // Savings % selector
  savingsPctCard: {
    borderRadius: BorderRadius.xl, padding: Spacing[4], gap: Spacing[3], marginBottom: Spacing[3],
  },
  savingsPctHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  savingsPctTitle:    { ...Typography.labelLarge, flex: 1 },
  savingsPctCurrent:  { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  savingsPctChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  savingsPctChip: {
    flex: 1, minWidth: 70, alignItems: 'center', paddingVertical: Spacing[2.5],
    borderRadius: BorderRadius.lg, gap: 2,
  },
  savingsPctChipText: { fontSize: 15, fontWeight: '700' },
  savingsPctChipAmt:  { fontSize: 10, fontWeight: '600' },

  // Custom budgets CTA
  ctaCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 20,
    borderRadius: 20, padding: 18, gap: 12,
    borderWidth: 1.5,
  },
  ctaTitle: { ...Typography.labelLarge },
  ctaSub:   { ...Typography.bodySmall, marginTop: 3, lineHeight: 18 },

  disclaimer: {
    marginHorizontal: 24, marginTop: 20, marginBottom: 8,
    fontSize: 11, lineHeight: 17, textAlign: 'center',
  },
});
