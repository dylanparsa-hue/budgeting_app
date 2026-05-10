import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MonthlyStats } from '../../types';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';
import { ProgressBar } from '../ui/ProgressBar';

interface CategoryBreakdownProps {
  stats:     MonthlyStats;
  currency?: string;
  onCategoryPress?: (categoryId: string) => void;
}

export function CategoryBreakdown({ stats, currency = 'MYR', onCategoryPress }: CategoryBreakdownProps) {
  const top = stats.byCategory.slice(0, 6);

  if (top.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🧾</Text>
        <Text style={styles.emptyText}>No expenses yet this month</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {top.map(({ category, amount, percentage }) => (
        <TouchableOpacity
          key={category.id}
          onPress={() => onCategoryPress?.(category.id)}
          activeOpacity={0.7}
          style={styles.row}
        >
          {/* Icon bubble */}
          <View style={[styles.iconBubble, { backgroundColor: category.color + '20' }]}>
            <Text style={styles.icon}>{category.icon}</Text>
          </View>

          {/* Name + bar */}
          <View style={styles.middle}>
            <View style={styles.labelRow}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.amount}>{formatCurrency(amount, currency)}</Text>
            </View>
            <ProgressBar
              progress={percentage}
              color={category.color}
              height={5}
              animated
            />
          </View>

          {/* Percentage */}
          <Text style={styles.pct}>{percentage.toFixed(0)}%</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing[3],
  },
  iconBubble: {
    width:          42,
    height:         42,
    borderRadius:   BorderRadius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  middle: {
    flex: 1,
    gap:  Spacing[1.5],
  },
  labelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  categoryName: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
  },
  amount: {
    ...Typography.bodySmall,
    color:      Colors.textSecondary,
    fontWeight: '600',
  },
  pct: {
    ...Typography.caption,
    color:    Colors.textTertiary,
    minWidth: 28,
    textAlign: 'right',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing[8],
    gap: Spacing[2],
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
});
