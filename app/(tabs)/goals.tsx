import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuthStore }  from '../../src/stores/authStore';
import { useGoalStore }  from '../../src/stores/goalStore';
import { GoalCard }      from '../../src/components/goals/GoalCard';
import { Button }        from '../../src/components/ui/Button';
import { Colors }        from '../../src/theme/colors';
import { Typography }    from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency } from '../../src/utils/currency';
import { parseCurrencyInput } from '../../src/utils/currency';

export default function GoalsScreen() {
  const { user, profile }                           = useAuthStore();
  const { goals, loadGoals, depositToGoal, removeGoal } = useGoalStore();
  const [refreshing,    setRefreshing]              = useState(false);
  const [depositGoalId, setDepositGoalId]           = useState<string | null>(null);
  const [depositAmount, setDepositAmount]           = useState('');
  const currency = profile?.currency ?? 'MYR';

  useEffect(() => {
    if (user) loadGoals(user.id);
  }, [user?.id]);

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await loadGoals(user.id);
    setRefreshing(false);
  };

  const handleDeposit = async () => {
    if (!depositGoalId) return;
    const amount = parseCurrencyInput(depositAmount);
    if (amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    await depositToGoal(depositGoalId, amount);
    setDepositGoalId(null);
    setDepositAmount('');
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, 'This will remove this savings goal.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeGoal(id) },
    ]);
  };

  const activeGoals    = goals.filter(g => !g.is_completed);
  const completedGoals = goals.filter(g => g.is_completed);
  const totalSaved     = goals.reduce((s, g) => s + g.current_amount, 0);
  const totalTarget    = goals.reduce((s, g) => s + g.target_amount, 0);
  const depositGoal    = goals.find(g => g.id === depositGoalId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Savings Goals</Text>
            <Text style={styles.subtitle}>Build your future</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/modals/add-goal')}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        {goals.length > 0 && (
          <View style={[styles.summaryCard, Shadow.md]}>
            <Text style={styles.summaryLabel}>Total Saved</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalSaved, currency)}</Text>
            <Text style={styles.summaryTarget}>
              of {formatCurrency(totalTarget, currency)} total target
            </Text>
            <View style={styles.summaryBar}>
              <View
                style={[
                  styles.summaryBarFill,
                  {
                    width: totalTarget > 0
                      ? `${Math.min((totalSaved / totalTarget) * 100, 100)}%`
                      : '0%',
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Active goals */}
        {activeGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active</Text>
            {activeGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                currency={currency}
                onPress={() => handleDelete(goal.id, goal.name)}
                onDeposit={() => {
                  setDepositGoalId(goal.id);
                  setDepositAmount('');
                }}
              />
            ))}
          </View>
        )}

        {/* Completed goals */}
        {completedGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Completed</Text>
            {completedGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                currency={currency}
              />
            ))}
          </View>
        )}

        {/* Empty state */}
        {goals.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyTitle}>No goals yet</Text>
            <Text style={styles.emptyText}>
              Set a savings goal — vacation, emergency fund, or anything you dream of
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/modals/add-goal')}
              style={styles.createBtn}
            >
              <Text style={styles.createBtnText}>Create a Goal</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: Spacing[20] }} />
      </ScrollView>

      {/* Deposit modal */}
      <Modal
        visible={!!depositGoalId}
        transparent
        animationType="slide"
        onRequestClose={() => setDepositGoalId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add savings</Text>
            <Text style={styles.modalSub}>
              {depositGoal?.icon} {depositGoal?.name}
            </Text>
            <View style={styles.depositInputRow}>
              <Text style={styles.depositSymbol}>{currency}</Text>
              <TextInput
                value={depositAmount}
                onChangeText={setDepositAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                style={styles.depositInput}
                autoFocus
              />
            </View>
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => setDepositGoalId(null)}
                style={{ flex: 1 }}
              />
              <Button
                label="Save"
                onPress={handleDeposit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing[5],
    paddingTop:        Spacing[4],
    gap:               Spacing[4],
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
  },
  title: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  addBtn: {
    backgroundColor:   Colors.primaryLight,
    paddingHorizontal: Spacing[4],
    paddingVertical:   Spacing[2],
    borderRadius:      BorderRadius.full,
  },
  addBtnText: {
    ...Typography.labelLarge,
    color: Colors.primary,
  },

  summaryCard: {
    backgroundColor: Colors.primary,
    borderRadius:    BorderRadius.xl,
    padding:         Spacing[5],
    alignItems:      'center',
    gap:             Spacing[1],
  },
  summaryLabel: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
  },
  summaryAmount: {
    ...Typography.amount,
    color: Colors.white,
  },
  summaryTarget: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  summaryBar: {
    width:           '100%',
    height:          8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius:    4,
    overflow:        'hidden',
    marginTop:       Spacing[2],
  },
  summaryBarFill: {
    height:          '100%',
    backgroundColor: Colors.white,
    borderRadius:    4,
  },

  section: {
    gap: Spacing[3],
  },
  sectionTitle: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },

  empty: {
    alignItems:    'center',
    paddingVertical: Spacing[14],
    gap:           Spacing[3],
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: {
    ...Typography.titleSmall,
    color: Colors.textSecondary,
  },
  emptyText: {
    ...Typography.bodySmall,
    color:     Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing[8],
  },
  createBtn: {
    backgroundColor:   Colors.primaryLight,
    paddingHorizontal: Spacing[6],
    paddingVertical:   Spacing[3],
    borderRadius:      BorderRadius.full,
    marginTop:         Spacing[2],
  },
  createBtnText: {
    ...Typography.labelLarge,
    color: Colors.primary,
  },

  // Deposit modal
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent:  'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius:  BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    padding:         Spacing[6],
    paddingBottom:   Spacing[10],
    gap:             Spacing[4],
  },
  modalTitle: {
    ...Typography.headingSmall,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  modalSub: {
    ...Typography.bodyMedium,
    color:     Colors.textSecondary,
    textAlign: 'center',
  },
  depositInputRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing[2],
  },
  depositSymbol: {
    ...Typography.headingSmall,
    color: Colors.textSecondary,
  },
  depositInput: {
    fontSize:   40,
    fontWeight: '700',
    color:      Colors.textPrimary,
    minWidth:   120,
    textAlign:  'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap:           Spacing[3],
    marginTop:     Spacing[2],
  },
});
