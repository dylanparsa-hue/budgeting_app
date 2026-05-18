import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Transaction } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';
import { format, isToday, isYesterday } from 'date-fns';
import { CATEGORY_ICON, Trash2 } from '../../lib/icons';
import type { LucideIcon } from 'lucide-react-native';
import { Package } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface TransactionItemProps {
  transaction:  Transaction;
  currency?:    string;
  onPress?:     () => void;
  onDelete?:    () => void;
}

export function TransactionItem({ transaction, currency = 'MYR', onPress, onDelete }: TransactionItemProps) {
  const C = useTheme();
  const { t } = useTranslation();

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    if (isToday(d))     return t('home.today');
    if (isYesterday(d)) return t('home.yesterday');
    return format(d, 'MMM d');
  }
  const { category, type, amount, note, date } = transaction;
  const isIncome = type === 'income';

  const IconComp: LucideIcon =
    CATEGORY_ICON[category?.icon?.toLowerCase() ?? ''] ??
    CATEGORY_ICON[category?.name?.toLowerCase() ?? ''] ??
    Package;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.row}>
        <View style={[styles.iconBubble, { backgroundColor: (category?.color ?? C.textTertiary) + '20' }]}>
          <IconComp size={20} color={category?.color ?? C.textTertiary} strokeWidth={2} />
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
          <Trash2 size={15} color={C.danger} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[3],
    gap: Spacing[3],
    minWidth: 0,
  },
  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  details: {
    flex: 1,
    gap: Spacing[0.5],
    minWidth: 0,
  },
  catName:  { ...Typography.titleSmall },
  note:     { ...Typography.bodySmall },
  dateText: { ...Typography.caption },
  right: {
    alignItems: 'flex-end',
    gap: Spacing[0.5],
    flexShrink: 0,
    paddingLeft: Spacing[2],
  },
  amount: {
    ...Typography.titleSmall,
    fontVariant: ['tabular-nums'] as any,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing[2],
    flexShrink: 0,
  },
});
