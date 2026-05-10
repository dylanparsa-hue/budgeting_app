import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';

import { useAuthStore }       from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useBudgetStore }     from '../../src/stores/budgetStore';
import { useGoalStore }       from '../../src/stores/goalStore';

import { InsightCard }        from '../../src/components/dashboard/InsightCard';
import { BalanceSummary }     from '../../src/components/dashboard/BalanceSummary';
import { CategoryBreakdown }  from '../../src/components/dashboard/CategoryBreakdown';
import { TransactionItem }    from '../../src/components/transactions/TransactionItem';
import { GoalCard }           from '../../src/components/goals/GoalCard';
import { Card }               from '../../src/components/ui/Card';

import { Colors }     from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Spacing }    from '../../src/theme/spacing';

import { generateInsights } from '../../src/utils/insights';

const now   = new Date();
const MONTH = now.getMonth() + 1;
const YEAR  = now.getFullYear();

export default function HomeScreen() {
  const { profile, user }                                   = useAuthStore();
  const { transactions, categories, syncFromServer, isSyncing, loadFromCache } = useTransactionStore();
  const { budgets, loadBudgets }                            = useBudgetStore();
  const { goals, loadGoals }                                = useGoalStore();

  const [refreshing, setRefreshing] = React.useState(false);

  // Initial load
  useEffect(() => {
    if (!user) return;
    loadFromCache(user.id);
    syncFromServer(user.id);
    loadBudgets(user.id, MONTH, YEAR);
    loadGoals(user.id);
  }, [user?.id]);

  const currentStats = useMemo(
    () => useTransactionStore.getState().getMonthlyStats(MONTH, YEAR),
    [transactions]
  );

  const budgetsWithSpend = useMemo(() => {
    return budgets.map(budget => {
      const spent = transactions
        .filter(t =>
          t.type === 'expense' &&
          t.category_id === budget.category_id &&
          new Date(t.date).getMonth() + 1 === MONTH &&
          new Date(t.date).getFullYear() === YEAR
        )
        .reduce((s, t) => s + t.amount, 0);
      return { ...budget, spent };
    });
  }, [budgets, transactions]);

  const insights = useMemo(
    () => generateInsights(currentStats, null, budgetsWithSpend, goals),
    [currentStats, budgetsWithSpend, goals]
  );

  const primaryInsight = insights[0];
  const activeGoals    = goals.filter(g => !g.is_completed).slice(0, 2);
  const recent         = transactions.slice(0, 5);

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await Promise.all([
      syncFromServer(user.id),
      loadBudgets(user.id, MONTH, YEAR),
      loadGoals(user.id),
    ]);
    setRefreshing(false);
  };

  const currency = profile?.currency ?? 'MYR';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const greeting  = getGreeting();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName} 👋</Text>
            <Text style={styles.monthLabel}>{format(now, 'MMMM yyyy')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/modals/add-transaction')}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* ── Insight Card (FIRST THING USERS SEE) ─────────────── */}
        {primaryInsight && (
          <InsightCard insight={primaryInsight} />
        )}

        {/* ── Balance Summary ───────────────────────────────────── */}
        <Card elevated style={styles.balanceCard}>
          <BalanceSummary
            totalIncome={currentStats.totalIncome}
            totalExpenses={currentStats.totalExpenses}
            currency={currency}
          />
        </Card>

        {/* ── Active Goals ──────────────────────────────────────── */}
        {activeGoals.length > 0 && (
          <Section
            title="Savings Goals"
            onSeeAll={() => router.push('/(tabs)/goals')}
          >
            {activeGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                currency={currency}
                onPress={() => router.push('/(tabs)/goals')}
              />
            ))}
          </Section>
        )}

        {/* ── Spending Breakdown ────────────────────────────────── */}
        <Section title="This Month">
          <Card>
            <CategoryBreakdown stats={currentStats} currency={currency} />
          </Card>
        </Section>

        {/* ── Recent Transactions ───────────────────────────────── */}
        {recent.length > 0 && (
          <Section
            title="Recent"
            onSeeAll={() => router.push('/(tabs)/transactions')}
          >
            <Card>
              {recent.map((tx, i) => (
                <View key={tx.id}>
                  <TransactionItem transaction={tx} currency={currency} />
                  {i < recent.length - 1 && <View style={styles.separator} />}
                </View>
              ))}
            </Card>
          </Section>
        )}

        {recent.length === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyText}>Tap + to add your first one</Text>
          </Card>
        )}

        <View style={{ height: Spacing[10] }} />
      </ScrollView>

      {/* ── Floating Add Button ───────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => router.push('/modals/add-transaction')}
        style={styles.fab}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function Section({
  title,
  onSeeAll,
  children,
}: {
  title:     string;
  onSeeAll?: () => void;
  children:  React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing[5],
    paddingTop:        Spacing[4],
    gap:               Spacing[5],
  },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  greeting: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  monthLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
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
    color:      Colors.white,
    fontSize:   22,
    fontWeight: '400',
    lineHeight: 26,
  },

  // Balance card
  balanceCard: {
    paddingVertical: Spacing[6],
  },

  // Sections
  section: {
    gap: Spacing[3],
  },
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  sectionTitle: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },
  seeAll: {
    ...Typography.bodySmall,
    color: Colors.primary,
  },
  sectionContent: {
    gap: Spacing[3],
  },

  // Empty state
  emptyCard: {
    alignItems:    'center',
    paddingVertical: Spacing[10],
    gap:           Spacing[2],
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    ...Typography.titleSmall,
    color: Colors.textSecondary,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },

  separator: {
    height:          1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing[1],
  },

  // FAB
  fab: {
    position:        'absolute',
    bottom:          Spacing[24],
    right:           Spacing[5],
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     Colors.primary,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.35,
    shadowRadius:    12,
    elevation:       8,
  },
  fabText: {
    color:    Colors.white,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 34,
  },
});
