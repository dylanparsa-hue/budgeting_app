/**
 * Insights Screen — two internal tabs
 *
 *  A. Transactions   — full history, search, filter, period stats, edit/delete
 *  B. Spending       — net chart, smart insights, by-category breakdown
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SectionList,
  TouchableOpacity, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  format, isToday, isYesterday,
  startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter,
} from 'date-fns';

import { useAuthStore }         from '../../src/stores/authStore';
import { useTransactionStore }  from '../../src/stores/transactionStore';
import { useRecurringStore }    from '../../src/stores/recurringStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { FinancialChart }       from '../../src/components/dashboard/FinancialChart';
import { ProgressBar }          from '../../src/components/ui/ProgressBar';
import { TransactionItem }      from '../../src/components/transactions/TransactionItem';
import { useTheme }             from '../../src/theme/ThemeContext';
import { Typography, FontFamily } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency }       from '../../src/utils/currency';
import { CATEGORY_ICON }        from '../../src/lib/icons';
import { Transaction }          from '../../src/types';
import { Search, X, Package }   from 'lucide-react-native';

// ─── Types & helpers ──────────────────────────────────────────────────────────

type InsightTab = 'Transactions' | 'Spending';
type TxFilter   = 'all' | 'income' | 'expense';
type StatPeriod = 'day' | 'week' | 'month' | 'year';

const now   = new Date();
const MONTH = now.getMonth() + 1;
const YEAR  = now.getFullYear();

function toMonthly(amount: number, freq: string) {
  if (freq === 'weekly') return amount * 52 / 12;
  if (freq === 'yearly') return amount / 12;
  return amount;
}

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const C = useTheme();
  const { user, profile }                = useAuthStore();
  const { transactions, syncFromServer } = useTransactionStore();
  const removeTransaction                = useTransactionStore(s => s.removeTransaction);
  const { items: recurring, load: loadRecurring } = useRecurringStore();
  const { insights }                     = useNotificationStore();

  const [activeTab,    setActiveTab]    = useState<InsightTab>('Transactions');
  const [refreshing,   setRefreshing]   = useState(false);

  // Transactions tab state
  const [txFilter,     setTxFilter]     = useState<TxFilter>('all');
  const [search,       setSearch]       = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [statPeriod,   setStatPeriod]   = useState<StatPeriod>('month');

  const currency = profile?.currency ?? 'MYR';

  useEffect(() => {
    if (user) syncFromServer(user.id);
    loadRecurring();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user) await syncFromServer(user.id);
    setRefreshing(false);
  };

  // ── Transactions tab computed ──────────────────────────────────────────────

  const billsMonthly = useMemo(
    () => recurring.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0),
    [recurring],
  );

  const filtered = useMemo(() => {
    let list = transactions;
    if (txFilter !== 'all') list = list.filter(t => t.type === txFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.note?.toLowerCase().includes(q) ||
        t.category?.name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [transactions, txFilter, search]);

  const sections = useMemo(() => groupByDate(filtered), [filtered]);

  const stats = useMemo(() => {
    const now = new Date();
    const starts: Record<StatPeriod, Date> = {
      day:   startOfDay(now),
      week:  startOfWeek(now, { weekStartsOn: 1 }),
      month: startOfMonth(now),
      year:  startOfYear(now),
    };
    const billsForPeriod: Record<StatPeriod, number> = {
      day:   billsMonthly / 30.44,
      week:  billsMonthly / 4.33,
      month: billsMonthly,
      year:  billsMonthly * 12,
    };
    const periodBills = billsForPeriod[statPeriod];
    const expenses = transactions.filter(
      t => t.type === 'expense' && isAfter(new Date(t.date), starts[statPeriod]),
    );
    const income = transactions.filter(
      t => t.type === 'income' && isAfter(new Date(t.date), starts[statPeriod]),
    );
    const manualSpent = expenses.reduce((s, t) => s + t.amount, 0);
    const earned      = income.reduce((s, t) => s + t.amount, 0);
    return {
      spent:  manualSpent + periodBills,
      earned,
      net:    earned - manualSpent - periodBills,
    };
  }, [transactions, statPeriod, billsMonthly]);

  const handleDelete = (tx: Transaction) => {
    removeTransaction(tx.id);
    setDeleteTarget(null);
  };

  // ── Spending tab computed ──────────────────────────────────────────────────

  const netChange = useMemo(() => {
    let net = 0;
    for (const t of transactions) {
      if (t.type === 'income') net += t.amount;
      else net -= t.amount;
    }
    return net;
  }, [transactions]);

  const selStats = useMemo(
    () => useTransactionStore.getState().getMonthlyStats(MONTH, YEAR),
    [transactions],
  );
  const topCats = selStats.byCategory.slice(0, 6);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: C.textPrimary }]}>Insights</Text>
        {activeTab === 'Transactions' && (
          <TouchableOpacity
            onPress={() => router.push('/modals/add-transaction')}
            style={[styles.addBtn, { backgroundColor: C.primary }]}
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Internal tab switcher ── */}
      <View style={[styles.tabBar, { backgroundColor: C.surfaceRaised }]}>
        {(['Transactions', 'Spending'] as InsightTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              activeTab === tab && [styles.tabBtnActive, { backgroundColor: C.surface }, Shadow.sm],
            ]}
          >
            <Text style={[
              styles.tabLabel,
              { color: activeTab === tab ? C.textPrimary : C.textTertiary },
              activeTab === tab && { fontWeight: '700' },
            ]}>
              {tab === 'Spending' ? 'Spending Insights' : 'Transactions'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══════════ TRANSACTIONS TAB ══════════ */}
      {activeTab === 'Transactions' && (
        <>
          {/* Search */}
          <View style={[styles.searchRow, { backgroundColor: C.surfaceRaised }]}>
            <View style={{ paddingLeft: 14 }}>
              <Search size={16} color={C.textTertiary} strokeWidth={2.25} />
            </View>
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
            {(['all', 'expense', 'income'] as TxFilter[]).map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setTxFilter(f)}
                style={[
                  styles.pill,
                  { backgroundColor: C.surfaceRaised },
                  txFilter === f && { backgroundColor: C.primaryLight },
                ]}
              >
                <Text style={[
                  styles.pillText,
                  { color: txFilter === f ? C.primary : C.textSecondary },
                ]}>
                  {f === 'all' ? 'All' : f === 'expense' ? '↓ Expenses' : '↑ Income'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Period stats card */}
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
                <Text style={[styles.statValue, { color: C.danger }]}>
                  {formatCurrency(stats.spent, currency)}
                </Text>
                {billsMonthly > 0 && (
                  <Text style={[styles.statSub, { color: C.textTertiary }]}>incl. bills</Text>
                )}
              </View>
              <View style={[styles.statSep, { backgroundColor: C.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: C.textTertiary }]}>Earned</Text>
                <Text style={[styles.statValue, { color: C.success }]}>
                  {formatCurrency(stats.earned, currency)}
                </Text>
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

          {/* Transaction list */}
          {sections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>
                {search ? 'No results found' : 'No transactions yet'}
              </Text>
              <Text style={[styles.emptyText, { color: C.textTertiary }]}>
                {search
                  ? 'Try a different search term'
                  : 'Tap + to add your first transaction'}
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
                  <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>
                    {section.title}
                  </Text>
                  <Text style={[styles.sectionCount, { color: C.textTertiary }]}>
                    {section.data.length}
                  </Text>
                </View>
              )}
              contentContainerStyle={styles.listContent}
              stickySectionHeadersEnabled
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: C.divider }]} />
              )}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
              }
            />
          )}
        </>
      )}

      {/* ══════════ SPENDING INSIGHTS TAB ══════════ */}
      {activeTab === 'Spending' && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
        >
          {/* Net change card */}
          <View style={[styles.card, { backgroundColor: C.surface }, Shadow.sm]}>
            <Text style={[styles.cardSub, { color: C.textSecondary }]}>Net change · last 12 months</Text>
            <Text style={[styles.netAmt, { color: netChange >= 0 ? C.textPrimary : C.danger }]}>
              {netChange < 0 ? '−' : ''}{formatCurrency(Math.abs(netChange), currency)}
            </Text>
            <FinancialChart
              transactions={transactions}
              recurring={recurring}
              currency={currency}
            />
          </View>

          {/* Smart insights */}
          {insights.length > 0 && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitleLarge, { color: C.textPrimary }]}>Smart insights</Text>
              </View>
              <View style={styles.insightsList}>
                {insights.slice(0, 4).map((insight, i) => (
                  <View key={i} style={[styles.insightCard, { backgroundColor: C.surface }, Shadow.sm]}>
                    <View style={[styles.insightIconBox, { backgroundColor: C.primaryLight }]}>
                      <Text style={styles.insightIcon}>{insight.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>
                        {insight.title}
                      </Text>
                      <Text style={{ ...Typography.bodySmall, color: C.textSecondary, marginTop: 2 }}>
                        {insight.message}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* By category */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitleLarge, { color: C.textPrimary }]}>By category</Text>
            <Text style={[styles.sectionSub, { color: C.textSecondary }]}>This month</Text>
          </View>
          {topCats.length > 0 ? (
            <View style={[styles.listCard, { backgroundColor: C.surface }, Shadow.sm]}>
              {topCats.map(({ category, amount, percentage }, i) => {
                const IconComp = CATEGORY_ICON[category.name?.toLowerCase()] ?? Package;
                return (
                  <View
                    key={category.id}
                    style={[
                      styles.catRow,
                      i < topCats.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: C.divider,
                      },
                    ]}
                  >
                    <View style={[styles.catIconBox, { backgroundColor: (category.color ?? C.primary) + '20' }]}>
                      <IconComp size={20} color={category.color ?? C.primary} strokeWidth={2.25} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>
                          {category.name}
                        </Text>
                        <Text style={{ ...Typography.bodySmall, color: C.textSecondary }}>
                          {formatCurrency(amount, currency)}
                        </Text>
                      </View>
                      <ProgressBar progress={percentage} color={category.color ?? C.primary} height={5} animated />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: C.surface, borderColor: C.border }, Shadow.sm]}>
              <Text style={[styles.emptyText, { color: C.textTertiary }]}>No expenses this month yet</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 4,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    fontWeight: '800',
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '400', lineHeight: 26 },

  // Internal tab bar
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabBtnActive: { borderRadius: 8 },
  tabLabel: { fontSize: 13, fontWeight: '600' },

  // ── Transactions tab ──────────────────────────────────────────────────────

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing[5],
    marginTop: Spacing[2],
    marginBottom: Spacing[3],
    borderRadius: BorderRadius.xl,
    height: 46,
    gap: Spacing[2],
  },
  searchInput: { flex: 1, ...Typography.bodyMedium },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[5],
    marginBottom: Spacing[3],
    gap: Spacing[2],
  },
  pill: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full,
  },
  pillText: { ...Typography.labelSmall },

  statsCard: {
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[3],
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  statsPeriodRow: { flexDirection: 'row', gap: Spacing[1] },
  statsPeriodBtn: {
    flex: 1,
    paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  statsPeriodText: { ...Typography.caption, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center', gap: Spacing[0.5] },
  statLabel: { ...Typography.caption },
  statValue: { ...Typography.titleSmall },
  statSub:   { fontSize: 9, opacity: 0.6 },
  statSep:   { width: 1, height: 28 },

  deleteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[2],
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2.5],
  },
  deleteBarText:    { ...Typography.bodySmall, flex: 1 },
  deleteBarActions: { flexDirection: 'row', gap: Spacing[4] },
  deleteBarBtn:     {},
  deleteBarBtnText: { ...Typography.labelSmall, fontWeight: '700' },

  listContent:   { paddingHorizontal: Spacing[5], paddingBottom: Spacing[20] },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing[2],
  },
  sectionTitle: { ...Typography.labelLarge },
  sectionCount: { ...Typography.caption },
  separator:    { height: 1 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { ...Typography.titleSmall },
  emptyText:  { ...Typography.bodySmall, textAlign: 'center', paddingHorizontal: Spacing[10] },

  // ── Spending Insights tab ─────────────────────────────────────────────────

  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    gap: 4,
  },
  cardSub: { fontSize: 13 },
  netAmt: {
    fontFamily: FontFamily.display,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitleLarge: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSub: { fontSize: 15 },

  insightsList: { gap: 8, marginHorizontal: 16 },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  insightIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  insightIcon: { fontSize: 20 },

  listCard: { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  catIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
