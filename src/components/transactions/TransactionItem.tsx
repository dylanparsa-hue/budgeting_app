import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Transaction } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';
import { format, isToday, isYesterday } from 'date-fns';

interface TransactionItemProps {
  transaction:  Transaction;
  currency?:    string;
  onPress?:     () => void;
  onDelete?:    () => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export function TransactionItem({ transaction, currency = 'MYR', onPress, onDelete }: TransactionItemProps) {
  const C = useTheme();
  const { category, type, amount, note, date } = transaction;
  const isIncome = type === 'income';

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={styles.row}
      >
        <View style={[styles.iconBubble, { backgroundColor: (category?.color ?? C.textTertiary) + '20' }]}>
          <Text style={styles.icon}>{category?.icon ?? '📦'}</Text>
        </View>
        <View style={styles.details}>
          <Text style={[styles.catName, { color: C.textPrimary }]} numberOfLines={1}>
            {category?.name ?? 'Uncategorized'}
          </Text>
          {note ? (
            <Text style={[styles.note, { color: C.textSecondary }]} numberOfLines={1}>{note}</Text>
          ) : (
            <Text style={[styles.dateText, { color: C.textTertiary }]}>{formatDate(date)}</Text>
          )}
        </View>
        <View style={styles.right}>
          <Text style={[styles.amount, isIncome ? { color: C.success } : { color: C.textPrimary }]}>
            {isIncome ? '+' : '-'}{formatCurrency(amount, currency)}
          </Text>
          {note && <Text style={[styles.dateText, { color: C.textTertiary }]}>{formatDate(date)}</Text>}
        </View>
      </TouchableOpacity>

      {onDelete && (
        <TouchableOpacity
          onPress={onDelete}
          style={[styles.deleteBtn, { backgroundColor: C.dangerLight }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteIcon}>🗑️</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
  },
  row: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing[2.5], gap: Spacing[3],
  },
  iconBubble: {
    width: 44, height: 44, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  icon:    { fontSize: 22 },
  details: { flex: 1, gap: Spacing[0.5] },
  catName: { ...Typography.titleSmall },
  note:    { ...Typography.bodySmall },
  dateText:{ ...Typography.caption },
  right:   { alignItems: 'flex-end', gap: Spacing[0.5] },
  amount:  { ...Typography.titleSmall, fontVariant: ['tabular-nums'] as any },
  deleteBtn: {
    width: 34, height: 34, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteIcon: { fontSize: 15 },
});
