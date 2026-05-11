import React, { useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useRecurringStore }   from '../../src/stores/recurringStore';
import { RecurringExpense }    from '../../src/types';
import { useTheme }            from '../../src/theme/ThemeContext';
import { Typography }          from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency }      from '../../src/utils/currency';

const CAT_META: Record<string, { icon: string; color: string }> = {
  rent:         { icon: '🏠', color: '#6366f1' },
  utilities:    { icon: '💡', color: '#f59e0b' },
  subscription: { icon: '📱', color: '#8b5cf6' },
  debt:         { icon: '💳', color: '#ef4444' },
  insurance:    { icon: '🛡️', color: '#3b82f6' },
  transport:    { icon: '🚗', color: '#10b981' },
  other:        { icon: '📦', color: '#6b7280' },
};

function toMonthly(amount: number, frequency: string) {
  if (frequency === 'weekly')  return amount * 52 / 12;
  if (frequency === 'yearly')  return amount / 12;
  return amount;
}

function buildRecommendations(params: {
  income: number;
  fixedTotal: number;
  variableSpent: number;
  items: RecurringExpense[];
  currency: string;
}) {
  const { income, fixedTotal, variableSpent, items, currency } = params;
  const tips: { icon: string; title: string; body: string; type: 'danger' | 'warning' | 'success' | 'info' }[] = [];

  if (income === 0) {
    tips.push({
      icon: '💡', type: 'info',
      title: 'Add your income first',
      body: 'Log an income transaction this month so we can calculate how much you have available.',
    });
    return tips;
  }

  const disposable = income - fixedTotal;
  const totalOut   = fixedTotal + variableSpent;
  const saveable   = income - totalOut;
  const savingsPct = saveable / income;
  const fixedPct   = fixedTotal  / income;
  const varPct     = variableSpent / income;

  // --- 50/30/20 rule ---
  const needsTarget  = income * 0.50;
  const wantsTarget  = income * 0.30;
  const savingsTarget = income * 0.20;

  if (fixedTotal > needsTarget) {
    tips.push({
      icon: '⚠️', type: 'danger',
      title: 'Fixed expenses too high',
      body: `Your fixed obligations (${formatCurrency(fixedTotal, currency)}/mo) exceed 50% of your income. Try to reduce or renegotiate at least one bill.`,
    });
  }

  if (saveable < 0) {
    tips.push({
      icon: '🚨', type: 'danger',
      title: 'Spending exceeds income',
      body: `You're spending ${formatCurrency(Math.abs(saveable), currency)} more than you earn. Cut variable expenses immediately.`,
    });
  } else if (savingsPct < 0.05) {
    tips.push({
      icon: '⚠️', type: 'warning',
      title: 'Almost nothing left to save',
      body: `Only ${formatCurrency(saveable, currency)} remains after all expenses. Aim to save at least ${formatCurrency(savingsTarget, currency)} (20% of income).`,
    });
  } else if (savingsPct >= 0.20) {
    tips.push({
      icon: '✅', type: 'success',
      title: 'Great savings rate!',
      body: `You're saving ${(savingsPct * 100).toFixed(0)}% of your income. Keep going — consider putting the surplus into a savings goal.`,
    });
  }

  // --- subscription audit ---
  const subs = items.filter(i => i.category === 'subscription');
  const subTotal = subs.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  if (subs.length >= 3) {
    tips.push({
      icon: '📱', type: 'warning',
      title: `${subs.length} active subscriptions`,
      body: `You're paying ${formatCurrency(subTotal, currency)}/mo on subscriptions. Review which ones you actually use.`,
    });
  }

  // --- debt alert ---
  const debts     = items.filter(i => i.category === 'debt');
  const debtTotal = debts.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  if (debtTotal / income > 0.30) {
    tips.push({
      icon: '💳', type: 'danger',
      title: 'High debt-to-income ratio',
      body: `Debt payments are ${(debtTotal / income * 100).toFixed(0)}% of your income. Prioritise paying off the highest-interest debt first.`,
    });
  }

  // --- recommended savings ---
  if (saveable > 0 && savingsPct < 0.20) {
    const gap = savingsTarget - saveable;
    tips.push({
      icon: '🎯', type: 'info',
      title: `Save ${formatCurrency(savingsTarget, currency)}/mo`,
      body: `To reach the 20% savings rule you need to free up ${formatCurrency(gap, currency)}. Try reducing dining, shopping, or entertainment.`,
    });
  }

  // --- low variable spending praise ---
  if (varPct < 0.20 && income > 0) {
    tips.push({
      icon: '🌟', type: 'success',
      title: 'Low day-to-day spending',
      body: `Your variable spending is only ${(varPct * 100).toFixed(0)}% of income. That's excellent discipline.`,
    });
  }

  // --- rent heavy ---
  const rent = items.filter(i => i.category === 'rent');
  const rentTotal = rent.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  if (rentTotal / income > 0.35) {
    tips.push({
      icon: '🏠', type: 'warning',
      title: 'Rent is above 35% of income',
      body: `Housing costs ${formatCurrency(rentTotal, currency)}/mo (${(rentTotal / income * 100).toFixed(0)}% of income). Consider if a cheaper option is feasible long-term.`,
    });
  }

  if (tips.length === 0) {
    tips.push({
      icon: '💚', type: 'success',
      title: 'Budget looks healthy',
      body: 'Your income covers your expenses well and you have room to save. Keep tracking!',
    });
  }

  return tips;
}

export default function PlanScreen() {
  const C = useTheme();
  const { profile }              = useAuthStore();
  const { transactions }         = useTransactionStore();
  const { items, loaded, load, remove } = useRecurringStore();

  useEffect(() => { load(); }, []);

  const currency = profile?.currency ?? 'MYR';

  const now        = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);

  const monthIncome = useMemo(() =>
    transactions
      .filter(t => t.type === 'income' && isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd }))
      .reduce((s, t) => s + t.amount, 0),
  [transactions]);

  const monthExpenses = useMemo(() =>
    transactions
      .filter(t => t.type === 'expense' && isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd }))
      .reduce((s, t) => s + t.amount, 0),
  [transactions]);

  const fixedMonthly = useMemo(() =>
    items.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0),
  [items]);

  const disposable = monthIncome - fixedMonthly;
  const saveable   = monthIncome - fixedMonthly - monthExpenses;

  const tips = useMemo(() => buildRecommendations({
    income: monthIncome,
    fixedTotal: fixedMonthly,
    variableSpent: monthExpenses,
    items,
    currency,
  }), [monthIncome, fixedMonthly, monthExpenses, items, currency]);

  const tipColors = {
    danger:  { bg: C.dangerLight,  text: C.danger  },
    warning: { bg: '#fef3c7',      text: '#92400e' },
    success: { bg: '#d1fae5',      text: '#065f46' },
    info:    { bg: C.primaryLight, text: C.primary  },
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: C.textPrimary }]}>Financial Plan</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>This month's picture</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/modals/add-recurring')}
            style={[styles.addBtn, { backgroundColor: C.primaryLight }]}
          >
            <Text style={[styles.addBtnText, { color: C.primary }]}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Smart Savings Planner banner */}
        <TouchableOpacity
          onPress={() => router.push('/modals/savings-planner' as any)}
          style={[styles.plannerBanner, { backgroundColor: C.primary }]}
          activeOpacity={0.85}
        >
          <View style={styles.plannerBannerLeft}>
            <Text style={styles.plannerBannerTitle}>Smart Savings Planner</Text>
            <Text style={styles.plannerBannerSub}>
              Goal plans · income gap · personalised advice
            </Text>
          </View>
          <View style={[styles.plannerBannerArrow, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
            <Text style={styles.plannerBannerArrowText}>→</Text>
          </View>
        </TouchableOpacity>

        {/* Overview card */}
        <View style={[styles.overviewCard, Shadow.md, { backgroundColor: C.surface }]}>
          <OverviewRow label="Monthly income" value={formatCurrency(monthIncome, currency)} color={C.success} C={C} />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <OverviewRow label="Fixed expenses" value={`- ${formatCurrency(fixedMonthly, currency)}`} color={C.danger} C={C} />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <OverviewRow label="Variable spending" value={`- ${formatCurrency(monthExpenses, currency)}`} color={C.textSecondary} C={C} />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <OverviewRow
            label="Left to save"
            value={formatCurrency(Math.max(saveable, 0), currency)}
            color={saveable >= 0 ? C.primary : C.danger}
            C={C}
            bold
          />
        </View>

        {/* Disposable bar */}
        {monthIncome > 0 && (
          <View style={[styles.barCard, Shadow.sm, { backgroundColor: C.surface }]}>
            <Text style={[styles.barLabel, { color: C.textSecondary }]}>Income allocation</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barSegment, { flex: Math.min(fixedMonthly / monthIncome, 1), backgroundColor: '#ef4444' }]} />
              <View style={[styles.barSegment, { flex: Math.min(monthExpenses / monthIncome, 1 - Math.min(fixedMonthly / monthIncome, 1)), backgroundColor: '#f59e0b' }]} />
              <View style={[styles.barSegment, { flex: Math.max(1 - fixedMonthly / monthIncome - monthExpenses / monthIncome, 0), backgroundColor: '#10b981' }]} />
            </View>
            <View style={styles.barLegend}>
              <LegendDot color="#ef4444" label="Fixed" />
              <LegendDot color="#f59e0b" label="Variable" />
              <LegendDot color="#10b981" label="Remaining" />
            </View>
          </View>
        )}

        {/* Fixed expenses list */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Fixed Obligations</Text>
          {items.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/modals/add-recurring')}
              style={[styles.emptyCard, { backgroundColor: C.surface, borderColor: C.border }]}
            >
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No fixed expenses yet</Text>
              <Text style={[styles.emptyText, { color: C.textTertiary }]}>
                Add rent, bills, subscriptions and debts to see your true disposable income
              </Text>
              <Text style={[styles.emptyAction, { color: C.primary }]}>Tap to add →</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.itemList}>
              {items.map(item => {
                const meta    = CAT_META[item.category] ?? CAT_META.other;
                const monthly = toMonthly(item.amount, item.frequency);
                return (
                  <View key={item.id} style={[styles.itemCard, Shadow.sm, { backgroundColor: C.surface }]}>
                    <View style={[styles.itemIcon, { backgroundColor: meta.color + '20' }]}>
                      <Text style={styles.itemEmoji}>{meta.icon}</Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: C.textPrimary }]}>{item.name}</Text>
                      <Text style={[styles.itemFreq, { color: C.textTertiary }]}>
                        {item.frequency === 'monthly' ? 'Monthly' : item.frequency === 'weekly' ? 'Weekly' : 'Yearly'}
                      </Text>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemAmount, { color: C.textPrimary }]}>
                        {formatCurrency(item.amount, currency)}
                      </Text>
                      {item.frequency !== 'monthly' && (
                        <Text style={[styles.itemMonthly, { color: C.textTertiary }]}>
                          {formatCurrency(monthly, currency)}/mo
                        </Text>
                      )}
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        onPress={() => router.push(`/modals/add-recurring?id=${item.id}`)}
                        style={[styles.actionBtn, { backgroundColor: C.primaryLight }]}
                      >
                        <Text style={styles.actionIcon}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => remove(item.id)}
                        style={[styles.actionBtn, { backgroundColor: C.dangerLight }]}
                      >
                        <Text style={styles.actionIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                onPress={() => router.push('/modals/add-recurring')}
                style={[styles.addMoreBtn, { borderColor: C.border }]}
              >
                <Text style={[styles.addMoreText, { color: C.primary }]}>+ Add another</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recommendations */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Smart Recommendations</Text>
          <View style={styles.tipList}>
            {tips.map((tip, i) => {
              const colors = tipColors[tip.type];
              return (
                <View key={i} style={[styles.tipCard, { backgroundColor: colors.bg }]}>
                  <Text style={styles.tipIcon}>{tip.icon}</Text>
                  <View style={styles.tipBody}>
                    <Text style={[styles.tipTitle, { color: colors.text }]}>{tip.title}</Text>
                    <Text style={[styles.tipText,  { color: colors.text + 'cc' }]}>{tip.body}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: Spacing[20] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewRow({ label, value, color, C, bold }: { label: string; value: string; color: string; C: any; bold?: boolean }) {
  return (
    <View style={styles.overviewRow}>
      <Text style={[styles.overviewLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[styles.overviewValue, { color }, bold && { fontSize: 18, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={{ fontSize: 11, color: '#6b7280' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: Spacing[5] },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title:       { ...Typography.headingMedium },
  subtitle:    { ...Typography.bodySmall },
  addBtn:      { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.full },
  addBtnText:  { ...Typography.labelLarge },

  plannerBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: BorderRadius.xl, padding: Spacing[5], gap: Spacing[3],
  },
  plannerBannerLeft:      { flex: 1, gap: Spacing[1] },
  plannerBannerTitle:     { fontSize: 17, fontWeight: '700', color: '#fff' },
  plannerBannerSub:       { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  plannerBannerArrow:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  plannerBannerArrowText: { fontSize: 18, color: '#fff', fontWeight: '700' },

  overviewCard: { borderRadius: BorderRadius.xl, padding: Spacing[5], gap: Spacing[3] },
  overviewRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overviewLabel:{ ...Typography.bodyMedium },
  overviewValue:{ ...Typography.titleSmall },
  divider:      { height: 1 },

  barCard:    { borderRadius: BorderRadius.xl, padding: Spacing[4], gap: Spacing[3] },
  barLabel:   { ...Typography.caption },
  barTrack:   { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  barSegment: { borderRadius: 5 },
  barLegend:  { flexDirection: 'row', gap: Spacing[4] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1.5] },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },

  section:      { gap: Spacing[3] },
  sectionTitle: { ...Typography.titleSmall },

  emptyCard: {
    alignItems: 'center', gap: Spacing[2], padding: Spacing[6],
    borderRadius: BorderRadius.xl, borderWidth: 1, borderStyle: 'dashed',
  },
  emptyIcon:   { fontSize: 36 },
  emptyTitle:  { ...Typography.titleSmall },
  emptyText:   { ...Typography.bodySmall, textAlign: 'center' },
  emptyAction: { ...Typography.labelLarge, marginTop: Spacing[2] },

  itemList: { gap: Spacing[2] },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    borderRadius: BorderRadius.xl, padding: Spacing[3.5],
  },
  itemIcon:    { width: 40, height: 40, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  itemEmoji:   { fontSize: 20 },
  itemInfo:    { flex: 1, gap: Spacing[0.5] },
  itemName:    { ...Typography.labelLarge },
  itemFreq:    { ...Typography.caption },
  itemRight:   { alignItems: 'flex-end', gap: Spacing[0.5] },
  itemAmount:  { ...Typography.labelLarge },
  itemMonthly: { ...Typography.caption },
  itemActions: { flexDirection: 'row', gap: Spacing[1.5] },
  actionBtn:   { width: 28, height: 28, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  actionIcon:  { fontSize: 13 },

  addMoreBtn: {
    alignItems: 'center', paddingVertical: Spacing[3],
    borderRadius: BorderRadius.xl, borderWidth: 1, borderStyle: 'dashed',
  },
  addMoreText: { ...Typography.labelLarge },

  tipList: { gap: Spacing[3] },
  tipCard: {
    flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start',
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  tipIcon:  { fontSize: 22, marginTop: 1 },
  tipBody:  { flex: 1, gap: Spacing[1] },
  tipTitle: { ...Typography.labelLarge },
  tipText:  { ...Typography.bodySmall, lineHeight: 20 },
});
