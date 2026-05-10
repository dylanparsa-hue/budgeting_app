import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Transaction } from '../../types';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';
import { format, isToday, isYesterday } from 'date-fns';

interface TransactionItemProps {
  transaction: Transaction;
  currency?:   string;
  onPress?:    () => void;
  onLongPress?: () => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export function TransactionItem({ transaction, currency = 'MYR', onPress, onLongPress }: TransactionItemProps) {
  const { category, type, amount, note, date } = transaction;
  const isIncome = type === 'income';

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      style={styles.row}
    >
      {/* Category icon bubble */}
      <View style={[styles.iconBubble, { backgroundColor: (category?.color ?? Colors.textTertiary) + '20' }]}>
        <Text style={styles.icon}>{category?.icon ?? '📦'}</Text>
      </View>

      {/* Details */}
      <View style={styles.details}>
        <Text style={styles.catName} numberOfLines={1}>
          {category?.name ?? 'Uncategorized'}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={1}>{note}</Text>
        ) : (
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        )}
      </View>

      {/* Amount + date */}
      <View style={styles.right}>
        <Text style={[styles.amount, isIncome ? styles.incomeAmount : styles.expenseAmount]}>
          {isIncome ? '+' : '-'}{formatCurrency(amount, currency)}
        </Text>
        {note && <Text style={styles.dateText}>{formatDate(date)}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: Spacing[2.5],
    gap:           Spacing[3],
  },
  iconBubble: {
    width:          44,
    height:         44,
    borderRadius:   BorderRadius.lg,
    alignItems:     'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
  },
  details: {
    flex: 1,
    gap:  Spacing[0.5],
  },
  catName: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
  },
  note: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  dateText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  right: {
    alignItems: 'flex-end',
    gap:        Spacing[0.5],
  },
  amount: {
    ...Typography.titleSmall,
    fontVariant: ['tabular-nums'],
  },
  incomeAmount:  { color: Colors.success },
  expenseAmount: { color: Colors.textPrimary },
});
