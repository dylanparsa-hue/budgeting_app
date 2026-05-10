import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Budget } from '../../types';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';
import { ProgressBar } from '../ui/ProgressBar';

interface BudgetCardProps {
  budget:    Budget;
  spent:     number;
  currency?: string;
  onPress?:  () => void;
}

export function BudgetCard({ budget, spent, currency = 'MYR', onPress }: BudgetCardProps) {
  const { category, amount } = budget;
  const pct       = Math.min((spent / amount) * 100, 100);
  const remaining = Math.max(amount - spent, 0);
  const isOver    = spent > amount;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, Shadow.sm]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconBubble, { backgroundColor: (category?.color ?? Colors.primary) + '20' }]}>
          <Text style={styles.icon}>{category?.icon ?? '📦'}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.catName}>{category?.name ?? 'Budget'}</Text>
          <Text style={styles.period}>Monthly</Text>
        </View>
        <View style={styles.amounts}>
          <Text style={[styles.spentAmount, isOver && { color: Colors.danger }]}>
            {formatCurrency(spent, currency)}
          </Text>
          <Text style={styles.budgetTotal}>/ {formatCurrency(amount, currency)}</Text>
        </View>
      </View>

      {/* Progress */}
      <ProgressBar progress={pct} color={category?.color} height={7} animated />

      {/* Footer */}
      <View style={styles.footer}>
        {isOver ? (
          <Text style={[styles.remainingText, { color: Colors.danger }]}>
            Over budget by {formatCurrency(spent - amount, currency)}
          </Text>
        ) : (
          <Text style={styles.remainingText}>
            {formatCurrency(remaining, currency)} remaining
          </Text>
        )}
        <Text style={[styles.pct, pct >= 90 && { color: Colors.danger }]}>
          {pct.toFixed(0)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    BorderRadius.xl,
    padding:         Spacing[4],
    gap:             Spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing[3],
  },
  iconBubble: {
    width:          44,
    height:         44,
    borderRadius:   BorderRadius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
  },
  headerText: {
    flex: 1,
    gap:  Spacing[0.5],
  },
  catName: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
  },
  period: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  amounts: {
    alignItems: 'flex-end',
    gap:        Spacing[0.5],
  },
  spentAmount: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
  },
  budgetTotal: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  footer: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  remainingText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  pct: {
    ...Typography.caption,
    color:      Colors.textTertiary,
    fontWeight: '600',
  },
});
