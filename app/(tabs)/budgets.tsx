import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useBudgetStore }      from '../../src/stores/budgetStore';
import { BudgetCard }          from '../../src/components/budgets/BudgetCard';
import { Colors }              from '../../src/theme/colors';
import { Typography }          from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency }      from '../../src/utils/currency';

const now   = new Date();
const MONTH = now.getMonth() + 1;
const YEAR  = now.getFullYear();

export default function BudgetsScreen() {
  const { user, profile }                        = useAuthStore();
  const { transactions }                         = useTransactionStore();
  const { budgets, loadBudgets, removeBudget }   = useBudgetStore();
  const [refreshing, setRefreshing]              = useState(false);

  useEffect(() => {
    if (user) loadBudgets(user.id, MONTH, YEAR);
  }, [user?.id]);

  const budgetsWithSpend = useMemo(() => {
    return budgets.map(budget => {
      const spent = transactions
        .filter(t =>
          t.type === 'expense' &&
          t.category_id === budget.category_id &&
          new Date(t.date).getMonth() + 1 === MONTH &&
          new Date(t.date).getFullYear() === YEAR
        )
        .reduce((s, t) => s + t.amount, 0);
      return { ...budget, spent };
    });
  }, [budgets, transactions]);

  const totalBudgeted = budgetsWithSpend.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgetsWithSpend.reduce((s, b) => s + (b.spent ?? 0), 0);
  const currency      = profile?.currency ?? 'MYR';

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await loadBudgets(user.id, MONTH, YEAR);
    setRefreshing(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Remove "${name}" budget?`, 'This will delete this budget.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeBudget(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Budgets</Text>
            <Text style={styles.subtitle}>{format(now, 'MMMM yyyy')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/modals/add-budget')}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Summary card */}
        {budgets.length > 0 && (
          <View style={[styles.summaryCard, Shadow.md]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Budgeted</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalBudgeted, currency)}</Text>
              </View>
              <View style={styles.summarySeparator} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Spent</Text>
                <Text style={[styles.summaryValue, { color: Colors.danger }]}>
                  {formatCurrency(totalSpent, currency)}
                </Text>
              </View>
              <View style={styles.summarySeparator} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Remaining</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  {formatCurrency(Math.max(totalBudgeted - totalSpent, 0), currency)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Budget list */}
        {budgetsWithSpend.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No budgets yet</Text>
            <Text style={styles.emptyText}>Set monthly budgets to control your spending</Text>
            <TouchableOpacity
              onPress={() => router.push('/modals/add-budget')}
              style={styles.createBtn}
            >
              <Text style={styles.createBtnText}>Create a Budget</Text>
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
                onPress={() => handleDelete(budget.id, budget.category?.name ?? 'Budget')}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing[20] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing[5],
    paddingTop:        Spacing[4],
    gap:               Spacing[4],
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
  },
  title: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  addBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing[4],
    paddingVertical:   Spacing[2],
    borderRadius:    BorderRadius.full,
  },
  addBtnText: {
    ...Typography.labelLarge,
    color: Colors.primary,
  },

  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius:    BorderRadius.xl,
    padding:         Spacing[5],
  },
  summaryRow: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    alignItems:     'center',
  },
  summaryItem: {
    alignItems: 'center',
    gap:        Spacing[1],
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  summaryValue: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
  },
  summarySeparator: {
    width:  1,
    height: 32,
    backgroundColor: Colors.border,
  },

  list: {
    gap: Spacing[3],
  },
  empty: {
    alignItems:    'center',
    paddingVertical: Spacing[14],
    gap:           Spacing[3],
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: {
    ...Typography.titleSmall,
    color: Colors.textSecondary,
  },
  emptyText: {
    ...Typography.bodySmall,
    color:     Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing[8],
  },
  createBtn: {
    backgroundColor:   Colors.primaryLight,
    paddingHorizontal: Spacing[6],
    paddingVertical:   Spacing[3],
    borderRadius:      BorderRadius.full,
    marginTop:         Spacing[2],
  },
  createBtnText: {
    ...Typography.labelLarge,
    color: Colors.primary,
  },
});
