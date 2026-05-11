import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';

interface MonthData {
  label:    string;
  income:   number;
  expenses: number;
}

interface SpendingChartProps {
  data:      MonthData[];
  currency?: string;
}

export function SpendingChart({ data, currency = 'MYR' }: SpendingChartProps) {
  const C       = useTheme();
  const maxVal  = Math.max(...data.flatMap(d => [d.income, d.expenses]), 1);
  const CHART_H = 100;

  return (
    <View>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.primary }]} />
          <Text style={[styles.legendText, { color: C.textSecondary }]}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.secondary }]} />
          <Text style={[styles.legendText, { color: C.textSecondary }]}>Expenses</Text>
        </View>
      </View>

      {/* Bars */}
      <View style={[styles.chartArea, { height: CHART_H }]}>
        {data.map((item, i) => {
          const incomeH  = maxVal > 0 ? (item.income   / maxVal) * CHART_H : 0;
          const expenseH = maxVal > 0 ? (item.expenses / maxVal) * CHART_H : 0;
          return (
            <View key={i} style={styles.barGroup}>
              <View style={styles.bars}>
                <View style={[styles.bar, { height: incomeH,  backgroundColor: C.primary,   borderRadius: 4 }]} />
                <View style={[styles.bar, { height: expenseH, backgroundColor: C.secondary, borderRadius: 4 }]} />
              </View>
              <Text style={[styles.barLabel, { color: C.textTertiary }]}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection:  'row',
    gap:            Spacing[4],
    marginBottom:   Spacing[3],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing[1.5],
  },
  legendDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  legendText: {
    ...Typography.caption,
  },
  chartArea: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'space-between',
  },
  barGroup: {
    flex:           1,
    alignItems:     'center',
    gap:            Spacing[1.5],
  },
  bars: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    gap:            Spacing[1],
    flex:           1,
    width:          '100%',
    justifyContent: 'center',
  },
  bar: {
    width: 10,
    minHeight: 4,
  },
  barLabel: {
    ...Typography.caption,
    fontSize: 10,
  },
});
