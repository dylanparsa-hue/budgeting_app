import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useBudgetStore }      from '../../src/stores/budgetStore';
import { BudgetCard }          from '../../src/components/budgets/BudgetCard';
import { useTheme }            from '../../src/theme/ThemeContext';
import { Typography }           from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency }      from '../../src/utils/currency';

const now   = new Date();
const MONTH = now.getMonth() + 1;
const YEAR  = now.getFullYear();

export default function BudgetsScreen() {
  const C = useTheme();
  const { user, profile }                      = useAuthStore();
  const { transactions }                       = useTransactionStore();
  const { budgets, loadBudgets, removeBudget } = useBudgetStore();
  const [refreshing, setRefreshing]            = useState(false);
  const [deleteId, setDeleteId]                = useState<string | null>(null);

  useEffect(() => {
    if (user) loadBudgets(user.id, MONTH, YEAR);
  }, [user?.id]);

  const budgetsWithSpend = useMemo(() => budgets.map(budget => ({
    ...budget,
    spent: transactions
      .filter(t =>
        t.type === 'expense' && t.category_id === budget.category_id &&
        new Date(t.date).getMonth() + 1 === MONTH && new Date(t.date).getFullYear() === YEAR
      )
      .reduce((s, t) => s + t.amount, 0),
  })), [budgets, transactions]);

  const totalBudgeted = budgetsWithSpend.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgetsWithSpend.reduce((s, b) => s + (b.spent ?? 0), 0);
  const currency      = profile?.currency ?? 'MYR';

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await loadBudgets(user.id, MONTH, YEAR);
    setRefreshing(false);
  };

  const budgetToDelete = budgetsWithSpend.find(b => b.id === deleteId);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: C.textPrimary }]}>Categories</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>{format(now, 'MMMM yyyy')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/modals/add-budget')}
            style={[styles.addBtn, { backgroundColor: C.primaryLight }]}
          >
            <Text style={[styles.addBtnText, { color: C.primary }]}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Inline delete confirmation */}
        {deleteId && budgetToDelete && (
          <View style={[styles.deleteBar, { backgroundColor: C.dangerLight }]}>
            <Text style={[styles.deleteBarText, { color: C.danger }]} numberOfLines={1}>
              Remove "{budgetToDelete.category?.name ?? 'Budget'}" budget?
            </Text>
            <View style={styles.deleteBarActions}>
              <TouchableOpacity onPress={() => setDeleteId(null)}>
                <Text style={[styles.deleteBarBtn, { color: C.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { removeBudget(deleteId); setDeleteId(null); }}>
                <Text style={[styles.deleteBarBtn, { color: C.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Summary card */}
        {budgets.length > 0 && (
          <View style={[styles.summaryCard, Shadow.md, { backgroundColor: C.surface }]}>
            <View style={styles.summaryRow}>
              <SumItem label="Budgeted" value={formatCurrency(totalBudgeted, currency)} color={C.textPrimary} C={C} />
              <View style={[styles.summarySep, { backgroundColor: C.border }]} />
              <SumItem label="Spent" value={formatCurrency(totalSpent, currency)} color={C.danger} C={C} />
              <View style={[styles.summarySep, { backgroundColor: C.border }]} />
              <SumItem
                label="Remaining"
                value={formatCurrency(Math.max(totalBudgeted - totalSpent, 0), currency)}
                color={C.success}
                C={C}
              />
            </View>
          </View>
        )}

        {/* Budget list */}
        {budgetsWithSpend.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No budgets yet</Text>
            <Text style={[styles.emptyText, { color: C.textTertiary }]}>Set monthly budgets to control your spending</Text>
            <TouchableOpacity
              onPress={() => router.push('/modals/add-budget')}
              style={[styles.createBtn, { backgroundColor: C.primaryLight }]}
            >
              <Text style={[styles.createBtnText, { color: C.primary }]}>Create a Budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {budgetsWithSpend.map(budget => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                spent={budget.spent ?? 0}
                currency={currency}
                onEdit={() => router.push(`/modals/add-budget?id=${budget.id}`)}
                onDelete={() => setDeleteId(budget.id)}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing[20] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SumItem({ label, value, color, C }: { label: string; value: string; color: string; C: any }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: Spacing[4] },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title:   { ...Typography.headingMedium },
  subtitle:{ ...Typography.bodySmall },
  addBtn:  {
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full,
  },
  addBtnText: { ...Typography.labelLarge },

  deleteBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2.5],
  },
  deleteBarText:    { ...Typography.bodySmall, flex: 1 },
  deleteBarActions: { flexDirection: 'row', gap: Spacing[4] },
  deleteBarBtn:     { ...Typography.labelSmall, fontWeight: '700' },

  summaryCard: { borderRadius: BorderRadius.xl, padding: Spacing[5] },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  summaryItem: { alignItems: 'center', gap: Spacing[1] },
  summaryLabel:{ ...Typography.caption },
  summaryValue:{ ...Typography.titleSmall },
  summarySep:  { width: 1, height: 32 },

  list:  { gap: Spacing[3] },
  empty: { alignItems: 'center', paddingVertical: Spacing[14], gap: Spacing[3] },
  emptyIcon:   { fontSize: 44 },
  emptyTitle:  { ...Typography.titleSmall },
  emptyText:   { ...Typography.bodySmall, textAlign: 'center', paddingHorizontal: Spacing[8] },
  createBtn:   {
    paddingHorizontal: Spacing[6], paddingVertical: Spacing[3],
    borderRadius: BorderRadius.full, marginTop: Spacing[2],
  },
  createBtnText: { ...Typography.labelLarge },
});
