import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';

interface BalanceSummaryProps {
  totalIncome:   number;
  totalExpenses: number;
  currency?:     string;
}

export function BalanceSummary({ totalIncome, totalExpenses, currency = 'MYR' }: BalanceSummaryProps) {
  const balance = totalIncome - totalExpenses;

  return (
    <View style={styles.container}>
      {/* Net balance — hero number */}
      <View style={styles.heroBlock}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={[styles.balanceAmount, balance < 0 && { color: Colors.danger }]}>
          {formatCurrency(balance, currency)}
        </Text>
      </View>

      {/* Income / Expenses row */}
      <View style={styles.row}>
        <SummaryPill
          label="Income"
          amount={totalIncome}
          currency={currency}
          color={Colors.success}
          bg={Colors.successLight}
          icon="↑"
        />
        <View style={styles.divider} />
        <SummaryPill
          label="Expenses"
          amount={totalExpenses}
          currency={currency}
          color={Colors.danger}
          bg={Colors.dangerLight}
          icon="↓"
        />
      </View>
    </View>
  );
}

interface PillProps {
  label:    string;
  amount:   number;
  currency: string;
  color:    string;
  bg:       string;
  icon:     string;
}

function SummaryPill({ label, amount, currency, color, bg, icon }: PillProps) {
  return (
    <View style={styles.pill}>
      <View style={[styles.pillIcon, { backgroundColor: bg }]}>
        <Text style={[styles.pillIconText, { color }]}>{icon}</Text>
      </View>
      <View>
        <Text style={styles.pillLabel}>{label}</Text>
        <Text style={[styles.pillAmount, { color }]}>
          {formatCurrency(amount, currency)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing[4],
  },
  heroBlock: {
    alignItems: 'center',
    gap:        Spacing[1],
  },
  balanceLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceAmount: {
    ...Typography.amount,
    color: Colors.textPrimary,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing[6],
  },
  divider: {
    width:  1,
    height: 36,
    backgroundColor: Colors.border,
  },
  pill: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing[3],
  },
  pillIcon: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pillIconText: {
    fontSize:   18,
    fontWeight: '700',
  },
  pillLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  pillAmount: {
    ...Typography.amountSmall,
  },
});
