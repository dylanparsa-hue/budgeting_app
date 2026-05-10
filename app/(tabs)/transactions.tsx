import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format, isToday, isYesterday } from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { Transaction }         from '../../src/types';
import { TransactionItem }     from '../../src/components/transactions/TransactionItem';
import { Colors }    from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';

type Filter = 'all' | 'income' | 'expense';

function groupByDate(txs: Transaction[]): { title: string; data: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>();
  txs.forEach(tx => {
    const d = new Date(tx.date);
    let key: string;
    if (isToday(d))     key = 'Today';
    else if (isYesterday(d)) key = 'Yesterday';
    else key = format(d, 'EEEE, MMM d');
    const group = groups.get(key) ?? [];
    group.push(tx);
    groups.set(key, group);
  });
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

export default function TransactionsScreen() {
  const { user, profile }                   = useAuthStore();
  const { transactions, syncFromServer }    = useTransactionStore();
  const removeTransaction                   = useTransactionStore(s => s.removeTransaction);
  const [filter, setFilter]                 = useState<Filter>('all');
  const [search, setSearch]                 = useState('');

  useEffect(() => {
    if (user) syncFromServer(user.id);
  }, [user?.id]);

  const filtered = useMemo(() => {
    let list = transactions;
    if (filter !== 'all')    list = list.filter(t => t.type === filter);
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

  const handleDelete = (tx: Transaction) => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeTransaction(tx.id),
      },
    ]);
  };

  const currency = profile?.currency ?? 'MYR';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity
          onPress={() => router.push('/modals/add-transaction')}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions…"
          placeholderTextColor={Colors.textTertiary}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(['all', 'expense', 'income'] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.pill, filter === f && styles.pillActive]}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f === 'all' ? 'All' : f === 'expense' ? '↓ Expenses' : '↑ Income'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyTitle}>
            {search ? 'No results found' : 'No transactions yet'}
          </Text>
          <Text style={styles.emptyText}>
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
              onLongPress={() => handleDelete(item)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: Spacing[5],
    paddingTop:        Spacing[4],
    paddingBottom:     Spacing[3],
  },
  title: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  addBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  addBtnText: {
    color:    Colors.white,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 26,
  },

  // Search
  searchRow: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  Spacing[5],
    marginBottom:      Spacing[3],
    backgroundColor:   Colors.surfaceRaised,
    borderRadius:      BorderRadius.xl,
    paddingHorizontal: Spacing[4],
    height:            46,
    gap:               Spacing[2],
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex:    1,
    ...Typography.bodyMedium,
    color:   Colors.textPrimary,
  },
  clearSearch: {
    color:    Colors.textTertiary,
    fontSize: 16,
  },

  // Filters
  filterRow: {
    flexDirection:     'row',
    paddingHorizontal: Spacing[5],
    marginBottom:      Spacing[3],
    gap:               Spacing[2],
  },
  pill: {
    paddingHorizontal: Spacing[4],
    paddingVertical:   Spacing[1.5],
    borderRadius:      BorderRadius.full,
    backgroundColor:   Colors.surfaceRaised,
  },
  pillActive: {
    backgroundColor: Colors.primaryLight,
  },
  pillText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.primary,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing[5],
    paddingBottom:     Spacing[20],
  },
  sectionHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: Colors.background,
    paddingVertical: Spacing[2],
  },
  sectionTitle: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
  },
  sectionCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  separator: {
    height:          1,
    backgroundColor: Colors.divider,
  },

  // Empty
  empty: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing[2],
  },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: {
    ...Typography.titleSmall,
    color: Colors.textSecondary,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing[10],
  },
});
