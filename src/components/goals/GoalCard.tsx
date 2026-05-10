import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SavingsGoal } from '../../types';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';
import { ProgressBar } from '../ui/ProgressBar';
import { format } from 'date-fns';

interface GoalCardProps {
  goal:      SavingsGoal;
  currency?: string;
  onPress?:  () => void;
  onDeposit?: () => void;
}

export function GoalCard({ goal, currency = 'MYR', onPress, onDeposit }: GoalCardProps) {
  const pct       = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  const remaining = goal.target_amount - goal.current_amount;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, Shadow.sm]}
    >
      {goal.is_completed && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>✓ Completed</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconBubble, { backgroundColor: goal.color + '20' }]}>
          <Text style={styles.icon}>{goal.icon}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{goal.name}</Text>
          {goal.deadline && (
            <Text style={styles.deadline}>
              Due {format(new Date(goal.deadline), 'MMM yyyy')}
            </Text>
          )}
        </View>
        <View style={styles.amounts}>
          <Text style={styles.current}>{formatCurrency(goal.current_amount, currency)}</Text>
          <Text style={styles.target}>/ {formatCurrency(goal.target_amount, currency)}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBlock}>
        <ProgressBar
          progress={pct}
          color={goal.is_completed ? Colors.success : goal.color}
          height={8}
          animated
        />
        <View style={styles.progressLabels}>
          <Text style={styles.pctLabel}>{pct.toFixed(0)}% saved</Text>
          {!goal.is_completed && (
            <Text style={styles.remainingLabel}>
              {formatCurrency(remaining, currency)} to go
            </Text>
          )}
        </View>
      </View>

      {/* Deposit button */}
      {!goal.is_completed && onDeposit && (
        <TouchableOpacity
          onPress={e => { e.stopPropagation(); onDeposit(); }}
          style={[styles.depositBtn, { backgroundColor: goal.color + '15' }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.depositText, { color: goal.color }]}>+ Add savings</Text>
        </TouchableOpacity>
      )}
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
  completedBadge: {
    position:        'absolute',
    top:             Spacing[3],
    right:           Spacing[3],
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing[2.5],
    paddingVertical:   Spacing[0.5],
    borderRadius:    BorderRadius.full,
  },
  completedText: {
    ...Typography.labelSmall,
    color: Colors.success,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing[3],
  },
  iconBubble: {
    width:          48,
    height:         48,
    borderRadius:   BorderRadius.lg,
    alignItems:     'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap:  Spacing[0.5],
  },
  name: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
  },
  deadline: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  amounts: {
    alignItems: 'flex-end',
    gap:        Spacing[0.5],
  },
  current: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
  },
  target: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  progressBlock: {
    gap: Spacing[1.5],
  },
  progressLabels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  pctLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  remainingLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  depositBtn: {
    borderRadius:   BorderRadius.lg,
    paddingVertical: Spacing[2.5],
    alignItems:     'center',
  },
  depositText: {
    ...Typography.labelLarge,
  },
});
