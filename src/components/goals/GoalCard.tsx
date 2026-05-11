import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SavingsGoal } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';
import { ProgressBar } from '../ui/ProgressBar';
import { format } from 'date-fns';

interface GoalCardProps {
  goal:        SavingsGoal;
  currency?:   string;
  onEdit?:     () => void;
  onDeposit?:  () => void;
  onWithdraw?: () => void;
}

export function GoalCard({ goal, currency = 'MYR', onEdit, onDeposit, onWithdraw }: GoalCardProps) {
  const C         = useTheme();
  const pct       = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  const remaining = goal.target_amount - goal.current_amount;

  return (
    <View style={[styles.card, Shadow.sm, { backgroundColor: C.surface }]}>
      {goal.is_completed && (
        <View style={[styles.completedBadge, { backgroundColor: C.successLight }]}>
          <Text style={[styles.completedText, { color: C.success }]}>✓ Completed</Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={[styles.iconBubble, { backgroundColor: goal.color + '20' }]}>
          <Text style={styles.icon}>{goal.icon}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: C.textPrimary }]} numberOfLines={1}>{goal.name}</Text>
          {goal.deadline && (
            <Text style={[styles.deadline, { color: C.textTertiary }]}>
              Due {format(new Date(goal.deadline), 'MMM yyyy')}
            </Text>
          )}
        </View>
        <View style={styles.amounts}>
          <Text style={[styles.current, { color: C.textPrimary }]}>{formatCurrency(goal.current_amount, currency)}</Text>
          <Text style={[styles.target, { color: C.textTertiary }]}>/ {formatCurrency(goal.target_amount, currency)}</Text>
        </View>
        {onEdit && (
          <TouchableOpacity
            onPress={onEdit}
            style={[styles.editBtn, { backgroundColor: C.surfaceRaised }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.editBtnText}>✏️</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.progressBlock}>
        <ProgressBar
          progress={pct}
          color={goal.is_completed ? C.success : goal.color}
          height={8}
          animated
        />
        <View style={styles.progressLabels}>
          <Text style={[styles.pctLabel, { color: C.textSecondary }]}>{pct.toFixed(0)}% saved</Text>
          {!goal.is_completed && (
            <Text style={[styles.remainingLabel, { color: C.textTertiary }]}>
              {formatCurrency(remaining, currency)} to go
            </Text>
          )}
        </View>
      </View>

      {(onDeposit || onWithdraw) && (
        <View style={styles.actionRow}>
          {!goal.is_completed && onDeposit && (
            <TouchableOpacity
              onPress={e => { e.stopPropagation(); onDeposit(); }}
              style={[styles.actionBtn, { backgroundColor: goal.color + '18' }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, { color: goal.color }]}>+ Add savings</Text>
            </TouchableOpacity>
          )}
          {onWithdraw && goal.current_amount > 0 && (
            <TouchableOpacity
              onPress={e => { e.stopPropagation(); onWithdraw(); }}
              style={[styles.actionBtn, { backgroundColor: C.dangerLight }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, { color: C.danger }]}>↓ Withdraw</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    padding:      Spacing[4],
    gap:          Spacing[3],
  },
  completedBadge: {
    position: 'absolute', top: Spacing[3], right: Spacing[3],
    paddingHorizontal: Spacing[2.5], paddingVertical: Spacing[0.5],
    borderRadius: BorderRadius.full,
  },
  completedText: { ...Typography.labelSmall },
  header:     { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  iconBubble: {
    width: 48, height: 48, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  icon:    { fontSize: 24 },
  info:    { flex: 1, gap: Spacing[0.5] },
  name:    { ...Typography.titleSmall },
  deadline:{ ...Typography.caption },
  amounts:     { alignItems: 'flex-end', gap: Spacing[0.5] },
  current:     { ...Typography.titleSmall },
  target:      { ...Typography.caption },
  editBtn:     { width: 30, height: 30, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing[1] },
  editBtnText: { fontSize: 14 },
  progressBlock:  { gap: Spacing[1.5] },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  pctLabel:       { ...Typography.caption },
  remainingLabel: { ...Typography.caption },
  actionRow:     { flexDirection: 'row', gap: Spacing[2] },
  actionBtn:     { flex: 1, borderRadius: BorderRadius.lg, paddingVertical: Spacing[2.5], alignItems: 'center' },
  actionBtnText: { ...Typography.labelLarge },
});
