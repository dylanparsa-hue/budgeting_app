import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList,
  TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  format, isToday, isYesterday,
  startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter,
} from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useRecurringStore }   from '../../src/stores/recurringStore';
import { Search, X } from 'lucide-react-native';
import { Transaction }         from '../../src/types';
import { TransactionItem }     from '../../src/components/transactions/TransactionItem';
import { useTheme }            from '../../src/theme/ThemeContext';
import { Typography }           from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency }      from '../../src/utils/currency';

function toMonthly(amount: number, freq: string) {
  if (freq === 'weekly') return amount * 52 / 12;
  if (freq === 'yearly') return amount / 12;
  return amount;
}

type Filter = 'all' | 'income' | 'expense';
type StatPeriod = 'day' | 'week' | 'month' | 'year';


function groupByDate(txs: Transaction[]): { title: string; data: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>();
  txs.forEach(tx => {
    const d = new Date(tx.date);
    let key: string;
    if (isToday(d))          key = 'Today';
    else if (isYesterday(d)) key = 'Yesterday';
    else                     key = format(d, 'EEEE, MMM d');
    const group = groups.get(key) ?? [];
    group.push(tx);
    groups.set(key, group);
  });
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

export default function TransactionsScreen() {
  const C = useTheme();
  const { user, profile }                = useAuthStore();
  const { transactions, syncFromServer } = useTransactionStore();
  const removeTransaction                = useTransactionStore(s => s.removeTransaction);
  const { items: recurring, load: loadRecurring } = useRecurringStore();
  const [filter, setFilter]              = useState<Filter>('all');
  const [search, setSearch]              = useState('');
  const [deleteTarget, setDeleteTarget]  = useState<Transaction | null>(null);
  const [statPeriod, setStatPeriod]      = useState<StatPeriod>('month');

  useEffect(() => {
    if (user) syncFromServer(user.id);
    loadRecurring();
  }, [user?.id]);

  // Bills total (monthly), normalised to the selected stat period
  const billsMonthly = useMemo(
    () => recurring.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0),
    [recurring],
  );

  const filtered = useMemo(() => {
    let list = transactions;
    if (filter !== 'all') list = list.filter(t => t.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.note?.toLowerCase().includes(q) ||
        t.category?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, filter, search]);

  const sections = useMemo(() => groupByDate(filtered), [filtered]);
  const currency = profile?.currency ?? 'MYR';

  const stats = useMemo(() => {
    const now = new Date();
    const starts: Record<StatPeriod, Date> = {
      day:   startOfDay(now),
      week:  startOfWeek(now, { weekStartsOn: 1 }),
      month: startOfMonth(now),
      year:  startOfYear(now),
    };

    // Recurring bills apportioned to the selected period so "Net" is always honest
    const billsForPeriod: Record<StatPeriod, number> = {
      day:   billsMonthly / 30.44,
      week:  billsMonthly / 4.33,
      month: billsMonthly,
      year:  billsMonthly * 12,
    };
    const periodBills = billsForPeriod[statPeriod];

    const expenses = transactions.filter(
      t => t.type === 'expense' && isAfter(new Date(t.date), starts[statPeriod])
    );
    const income = transactions.filter(
      t => t.type === 'income' && isAfter(new Date(t.date), starts[statPeriod])
    );
    const manualSpent = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const earned      = income.reduce((s, t) => s + Number(t.amount), 0);
    return {
      spent:  manualSpent + periodBills,          // manual + recurring bills
      earned,
      net:    earned - manualSpent - periodBills, // true available
    };
  }, [transactions, statPeriod, billsMonthly]);

  const handleDelete = (tx: Transaction) => {
    removeTransaction(tx.id);
    setDeleteTarget(null);
  };


  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: C.textPrimary }]}>Transactions</Text>
        <TouchableOpacity
          onPress={() => router.push('/modals/add-transaction')}
          style={[styles.addBtn, { backgroundColor: C.primary }]}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: C.surfaceRaised }]}>
        <View style={{ paddingLeft: 14 }}><Search size={16} color={C.textTertiary} strokeWidth={2.25} /></View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions…"
          placeholderTextColor={C.textTertiary}
          style={[styles.searchInput, { color: C.textPrimary }]}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={{ paddingRight: 14 }}>
            <X size={16} color={C.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(['all', 'expense', 'income'] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.pill,
              { backgroundColor: C.surfaceRaised },
              filter === f && { backgroundColor: C.primaryLight },
            ]}
          >
            <Text style={[
              styles.pillText,
              { color: filter === f ? C.primary : C.textSecondary },
            ]}>
              {f === 'all' ? 'All' : f === 'expense' ? '↓ Expenses' : '↑ Income'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Spending stats card */}
      <View style={[styles.statsCard, Shadow.sm, { backgroundColor: C.surface }]}>
        <View style={styles.statsPeriodRow}>
          {(['day', 'week', 'month', 'year'] as StatPeriod[]).map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setStatPeriod(p)}
              style={[
                styles.statsPeriodBtn,
                statPeriod === p && { backgroundColor: C.primary },
              ]}
            >
              <Text style={[
                styles.statsPeriodText,
                { color: statPeriod === p ? '#fff' : C.textSecondary },
              ]}>
                {p === 'day' ? 'Day' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: C.textTertiary }]}>Spent</Text>
            <Text style={[styles.statValue, { color: C.danger }]}>{formatCurrency(stats.spent, currency)}</Text>
            {billsMonthly > 0 && (
              <Text style={[styles.statSub, { color: C.textTertiary }]}>incl. bills</Text>
            )}
          </View>
          <View style={[styles.statSep, { backgroundColor: C.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: C.textTertiary }]}>Earned</Text>
            <Text style={[styles.statValue, { color: C.success }]}>{formatCurrency(stats.earned, currency)}</Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: C.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: C.textTertiary }]}>Net</Text>
            <Text style={[styles.statValue, { color: stats.net >= 0 ? C.success : C.danger }]}>
              {stats.net >= 0 ? '+' : ''}{formatCurrency(stats.net, currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* Inline delete confirmation */}
      {deleteTarget && (
        <View style={[styles.deleteBar, { backgroundColor: C.dangerLight }]}>
          <Text style={[styles.deleteBarText, { color: C.danger }]} numberOfLines={1}>
            Delete "{deleteTarget.category?.name ?? 'transaction'}"?
          </Text>
          <View style={styles.deleteBarActions}>
            <TouchableOpacity onPress={() => setDeleteTarget(null)} style={styles.deleteBarBtn}>
              <Text style={[styles.deleteBarBtnText, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(deleteTarget)} style={styles.deleteBarBtn}>
              <Text style={[styles.deleteBarBtnText, { color: C.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* List */}
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>
            {search ? 'No results found' : 'No transactions yet'}
          </Text>
          <Text style={[styles.emptyText, { color: C.textTertiary }]}>
            {search ? 'Try a different search term' : 'Add your first transaction with the + button'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TransactionItem
              transaction={item}
              currency={currency}
              onPress={() => router.push(`/modals/add-transaction?id=${item.id}`)}
              onDelete={() => setDeleteTarget(item)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: C.background }]}>
              <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>{section.title}</Text>
              <Text style={[styles.sectionCount, { color: C.textTertiary }]}>{section.data.length}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: C.divider }]} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[3],
  },
  title:      { ...Typography.headingMedium },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '400', lineHeight: 26 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing[5], marginBottom: Spacing[3],
    borderRadius: BorderRadius.xl, paddingHorizontal: Spacing[4],
    height: 46, gap: Spacing[2],
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, ...Typography.bodyMedium },
  clearSearch: { fontSize: 16 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing[5],
    marginBottom: Spacing[3], gap: Spacing[2],
  },
  pill: {
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full,
  },
  pillText: { ...Typography.labelSmall },

  statsCard: {
    marginHorizontal: Spacing[5], marginBottom: Spacing[3],
    borderRadius: BorderRadius.xl, padding: Spacing[4], gap: Spacing[3],
  },
  statsPeriodRow: {
    flexDirection: 'row', gap: Spacing[1],
    backgroundColor: 'transparent',
  },
  statsPeriodBtn: {
    flex: 1, paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.lg, alignItems: 'center',
  },
  statsPeriodText: { ...Typography.caption, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center', gap: Spacing[0.5] },
  statLabel: { ...Typography.caption },
  statValue: { ...Typography.titleSmall },
  statSub:   { fontSize: 9, opacity: 0.6 },
  statSep:   { width: 1, height: 28 },

  deleteBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing[5], marginBottom: Spacing[2],
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2.5],
  },
  deleteBarText:    { ...Typography.bodySmall, flex: 1 },
  deleteBarActions: { flexDirection: 'row', gap: Spacing[4] },
  deleteBarBtn:     {},
  deleteBarBtnText: { ...Typography.labelSmall, fontWeight: '700' },

  listContent:  { paddingHorizontal: Spacing[5], paddingBottom: Spacing[20] },
  sectionHeader:{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing[2],
  },
  sectionTitle: { ...Typography.labelLarge },
  sectionCount: { ...Typography.caption },
  separator:    { height: 1 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing[2],
  },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { ...Typography.titleSmall },
  emptyText:  { ...Typography.bodySmall, textAlign: 'center', paddingHorizontal: Spacing[10] },
});
