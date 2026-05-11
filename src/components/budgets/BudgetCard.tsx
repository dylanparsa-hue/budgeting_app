import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Budget } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';
import { ProgressBar } from '../ui/ProgressBar';

interface BudgetCardProps {
  budget:    Budget;
  spent:     number;
  currency?: string;
  onEdit?:   () => void;
  onDelete?: () => void;
}

export function BudgetCard({ budget, spent, currency = 'MYR', onEdit, onDelete }: BudgetCardProps) {
  const C = useTheme();
  const { category, amount } = budget;
  const pct       = Math.min((spent / amount) * 100, 100);
  const remaining = Math.max(amount - spent, 0);
  const isOver    = spent > amount;

  return (
    <View style={[styles.card, Shadow.sm, { backgroundColor: C.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconBubble, { backgroundColor: (category?.color ?? C.primary) + '20' }]}>
          <Text style={styles.icon}>{category?.icon ?? '📦'}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.catName, { color: C.textPrimary }]}>{category?.name ?? 'Budget'}</Text>
          <Text style={[styles.period, { color: C.textTertiary }]}>Monthly</Text>
        </View>
        <View style={styles.amounts}>
          <Text style={[styles.spentAmount, { color: isOver ? C.danger : C.textPrimary }]}>
            {formatCurrency(spent, currency)}
          </Text>
          <Text style={[styles.budgetTotal, { color: C.textTertiary }]}>/ {formatCurrency(amount, currency)}</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              style={[styles.actionBtn, { backgroundColor: C.primaryLight }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.actionIcon}>✏️</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              style={[styles.actionBtn, { backgroundColor: C.dangerLight }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.actionIcon}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ProgressBar progress={pct} color={category?.color} height={7} animated />

      <View style={styles.footer}>
        {isOver ? (
          <Text style={[styles.remainingText, { color: C.danger }]}>
            Over budget by {formatCurrency(spent - amount, currency)}
          </Text>
        ) : (
          <Text style={[styles.remainingText, { color: C.textSecondary }]}>
            {formatCurrency(remaining, currency)} remaining
          </Text>
        )}
        <Text style={[styles.pct, { color: pct >= 90 ? C.danger : C.textTertiary }]}>
          {pct.toFixed(0)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    padding:      Spacing[4],
    gap:          Spacing[3],
  },
  header:     { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  iconBubble: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  icon:       { fontSize: 22 },
  headerText: { flex: 1, gap: Spacing[0.5] },
  catName:    { ...Typography.titleSmall },
  period:     { ...Typography.caption },
  amounts:    { alignItems: 'flex-end', gap: Spacing[0.5] },
  spentAmount:{ ...Typography.titleSmall },
  budgetTotal:{ ...Typography.caption },
  actions:    { flexDirection: 'row', gap: Spacing[1.5] },
  actionBtn:  {
    width: 30, height: 30, borderRadius: BorderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  actionIcon: { fontSize: 14 },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  remainingText: { ...Typography.caption },
  pct: { ...Typography.caption, fontWeight: '600' },
});
