import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useGoalStore }        from '../../src/stores/goalStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { GoalCard }            from '../../src/components/goals/GoalCard';
import { Button }              from '../../src/components/ui/Button';
import { useTheme }            from '../../src/theme/ThemeContext';
import { Typography }          from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';
import { formatCurrency, parseCurrencyInput } from '../../src/utils/currency';

type ModalMode = 'add' | 'withdraw';

export default function GoalsScreen() {
  const C = useTheme();
  const { user, profile }                                        = useAuthStore();
  const { goals, loadGoals, depositToGoal, updateGoal } = useGoalStore();
  const { addTransaction, categories }                             = useTransactionStore();

  const [refreshing,  setRefreshing]  = useState(false);
  const [modalGoalId, setModalGoalId] = useState<string | null>(null);
  const [modalMode,   setModalMode]   = useState<ModalMode>('add');
  const [amount,      setAmount]      = useState('');
  const [amountError, setAmountError] = useState('');
  const [isSaving,    setIsSaving]    = useState(false);

  const currency  = profile?.currency ?? 'MYR';
  const modalGoal = goals.find(g => g.id === modalGoalId);

  useEffect(() => { if (user) loadGoals(user.id); }, [user?.id]);

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await loadGoals(user.id);
    setRefreshing(false);
  };

  const openModal = (goalId: string, mode: ModalMode) => {
    setModalGoalId(goalId);
    setModalMode(mode);
    setAmount('');
    setAmountError('');
  };

  const closeModal = () => {
    setModalGoalId(null);
    setAmount('');
    setAmountError('');
  };

  // Helper to find the best category for savings transactions
  const savingsExpenseCat = () =>
    categories.find(c => /saving|invest|transfer/i.test(c.name) && (c.type === 'expense' || c.type === 'both'))
    ?? categories.find(c => c.type === 'expense' || c.type === 'both');

  const incomeCat = () =>
    categories.find(c => c.type === 'income' || c.type === 'both');

  const makeIncomeTransaction = (amt: number, note: string) => {
    if (!user) return Promise.resolve();
    // Use any income category, fall back to any category, fall back to null
    const cat = categories.find(c => c.type === 'income' || c.type === 'both')
              ?? categories[0];
    return addTransaction(user.id, {
      type:           'income',
      amount:         amt,
      date:           format(new Date(), 'yyyy-MM-dd'),
      category_id:    cat?.id ?? null,
      note,
      payment_method: 'transfer',
      tags:           ['savings'],
      is_recurring:   false,
      group_id:       null,
      user_id:        user.id,
    });
  };

  const handleConfirm = async () => {
    if (!modalGoalId || !user || !modalGoal) return;
    const parsed = parseCurrencyInput(amount);
    if (parsed <= 0) { setAmountError('Please enter a valid amount.'); return; }

    setIsSaving(true);
    setAmountError('');
    try {
      if (modalMode === 'add') {
        const canAdd = modalGoal.target_amount - modalGoal.current_amount;
        if (parsed > canAdd) {
          setAmountError(`Max you can add is ${formatCurrency(canAdd, currency)}`);
          return;
        }
        await depositToGoal(modalGoalId, parsed);
        const expCat = categories.find(c =>
          /saving|invest|transfer/i.test(c.name) && (c.type === 'expense' || c.type === 'both')
        ) ?? categories.find(c => c.type === 'expense' || c.type === 'both') ?? categories[0];
        await addTransaction(user.id, {
          type:           'expense',
          amount:         parsed,
          date:           format(new Date(), 'yyyy-MM-dd'),
          category_id:    expCat?.id ?? null,
          note:           `Savings: ${modalGoal.name}`,
          payment_method: 'transfer',
          tags:           ['savings'],
          is_recurring:   false,
          group_id:       null,
          user_id:        user.id,
        });
      } else {
        if (parsed > modalGoal.current_amount) {
          setAmountError(`You only have ${formatCurrency(modalGoal.current_amount, currency)} saved`);
          return;
        }
        const withdrawAmt  = Math.min(parsed, modalGoal.current_amount);
        const newSaved     = modalGoal.current_amount - withdrawAmt;
        // Income transaction first — balance goes back up
        await makeIncomeTransaction(withdrawAmt, `Withdrawal: ${modalGoal.name}`);
        // Then reduce the goal's saved amount
        await updateGoal(modalGoalId, { current_amount: newSaved, is_completed: false });
      }
      closeModal();
    } catch (err: any) {
      setAmountError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };


  const activeGoals    = goals.filter(g => !g.is_completed);
  const completedGoals = goals.filter(g => g.is_completed);
  const totalSaved     = goals.reduce((s, g) => s + g.current_amount, 0);
  const totalTarget    = goals.reduce((s, g) => s + g.target_amount, 0);

  const maxWithdraw = modalGoal?.current_amount ?? 0;
  const maxAdd      = modalGoal ? modalGoal.target_amount - modalGoal.current_amount : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: C.textPrimary }]}>Savings</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>Build your future</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/modals/add-goal')}
            style={[styles.addBtn, { backgroundColor: C.primaryLight }]}
          >
            <Text style={[styles.addBtnText, { color: C.primary }]}>+ New</Text>
          </TouchableOpacity>
        </View>


        {/* Smart Savings Planner banner */}
        <TouchableOpacity
          onPress={() => router.push('/modals/savings-planner' as any)}
          style={[styles.plannerBanner, { backgroundColor: C.primary }]}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.plannerBannerTitle}>🎯 Smart Savings Planner</Text>
            <Text style={styles.plannerBannerSub}>See how much to save per goal each month</Text>
          </View>
          <View style={[styles.plannerBannerArrow, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
            <Text style={styles.plannerBannerArrowText}>→</Text>
          </View>
        </TouchableOpacity>

        {/* Summary */}
        {goals.length > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: C.primary }]}>
            <Text style={styles.summaryLabel}>Total Saved</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalSaved, currency)}</Text>
            <Text style={styles.summaryTarget}>of {formatCurrency(totalTarget, currency)} total target</Text>
            <View style={styles.summaryBar}>
              <View style={[styles.summaryBarFill, {
                width: totalTarget > 0 ? `${Math.min((totalSaved / totalTarget) * 100, 100)}%` : '0%',
              }]} />
            </View>
          </View>
        )}

        {/* Active goals */}
        {activeGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Active</Text>
            {activeGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                currency={currency}
                onEdit={() => router.push(`/modals/add-goal?id=${goal.id}` as any)}
                onDeposit={() => openModal(goal.id, 'add')}
                onWithdraw={() => openModal(goal.id, 'withdraw')}
              />
            ))}
          </View>
        )}

        {/* Completed goals */}
        {completedGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>🏆 Completed</Text>
            {completedGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                currency={currency}
                onEdit={() => router.push(`/modals/add-goal?id=${goal.id}` as any)}
                onWithdraw={() => openModal(goal.id, 'withdraw')}
              />
            ))}
          </View>
        )}

        {goals.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No goals yet</Text>
            <Text style={[styles.emptyText, { color: C.textTertiary }]}>
              Set a savings goal — vacation, emergency fund, or anything you dream of
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/modals/add-goal')}
              style={[styles.createBtn, { backgroundColor: C.primaryLight }]}
            >
              <Text style={[styles.createBtnText, { color: C.primary }]}>Create a Goal</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: Spacing[20] }} />
      </ScrollView>

      {/* Add / Withdraw modal */}
      <Modal
        visible={!!modalGoalId}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} />
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <TouchableOpacity
              onPress={closeModal}
              style={[styles.modalCloseBtn, { backgroundColor: C.surfaceRaised }]}
            >
              <Text style={[styles.modalCloseBtnText, { color: C.textSecondary }]}>✕</Text>
            </TouchableOpacity>

            {/* Mode toggle */}
            <View style={[styles.modeToggle, { backgroundColor: C.surfaceRaised }]}>
              <TouchableOpacity
                onPress={() => { setModalMode('add'); setAmount(''); setAmountError(''); }}
                style={[styles.modeBtn, modalMode === 'add' && { backgroundColor: C.primary }]}
              >
                <Text style={[styles.modeBtnText, { color: modalMode === 'add' ? '#fff' : C.textSecondary }]}>
                  ↑ Add savings
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setModalMode('withdraw'); setAmount(''); setAmountError(''); }}
                style={[styles.modeBtn, modalMode === 'withdraw' && { backgroundColor: C.danger }]}
              >
                <Text style={[styles.modeBtnText, { color: modalMode === 'withdraw' ? '#fff' : C.textSecondary }]}>
                  ↓ Withdraw
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: C.textSecondary }]}>
              {modalGoal?.icon} {modalGoal?.name}
            </Text>

            {modalMode === 'add' ? (
              <Text style={[styles.modalHint, { color: C.textTertiary }]}>
                {formatCurrency(modalGoal?.current_amount ?? 0, currency)} saved · {formatCurrency(maxAdd, currency)} remaining to target
              </Text>
            ) : (
              <Text style={[styles.modalHint, { color: C.textTertiary }]}>
                {formatCurrency(maxWithdraw, currency)} available to withdraw · returns to your balance
              </Text>
            )}

            {amountError ? (
              <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
                <Text style={[styles.errorText, { color: C.danger }]}>{amountError}</Text>
              </View>
            ) : null}

            <View style={styles.depositInputRow}>
              <Text style={[styles.depositSymbol, { color: C.textSecondary }]}>{currency}</Text>
              <TextInput
                value={amount}
                onChangeText={v => { setAmount(v); setAmountError(''); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.textTertiary}
                style={[styles.depositInput, { color: C.textPrimary }]}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirm}
              />
            </View>

            <View style={styles.modalActions}>
              <Button label="Cancel" variant="ghost" onPress={closeModal} style={{ flex: 1 }} disabled={isSaving} />
              <Button
                label={isSaving ? 'Saving…' : modalMode === 'add' ? 'Add to Savings' : 'Withdraw'}
                onPress={handleConfirm}
                loading={isSaving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: Spacing[4] },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title:   { ...Typography.headingMedium },
  subtitle:{ ...Typography.bodySmall },
  addBtn:  { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.full },
  addBtnText: { ...Typography.labelLarge },

  plannerBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: BorderRadius.xl, padding: Spacing[4], gap: Spacing[3],
  },
  plannerBannerTitle:     { fontSize: 15, fontWeight: '700', color: '#fff' },
  plannerBannerSub:       { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  plannerBannerArrow:     { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  plannerBannerArrowText: { fontSize: 17, color: '#fff', fontWeight: '700' },

  summaryCard: {
    borderRadius: BorderRadius.xl, padding: Spacing[5], alignItems: 'center', gap: Spacing[1],
  },
  summaryLabel:   { ...Typography.bodySmall, color: 'rgba(255,255,255,0.8)' },
  summaryAmount:  { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  summaryTarget:  { ...Typography.caption, color: 'rgba(255,255,255,0.7)' },
  summaryBar:     { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden', marginTop: Spacing[2] },
  summaryBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },

  section:      { gap: Spacing[3] },
  sectionTitle: { ...Typography.titleMedium },

  empty:         { alignItems: 'center', paddingVertical: Spacing[14], gap: Spacing[3] },
  emptyIcon:     { fontSize: 44 },
  emptyTitle:    { ...Typography.titleSmall },
  emptyText:     { ...Typography.bodySmall, textAlign: 'center', paddingHorizontal: Spacing[8] },
  createBtn:     { paddingHorizontal: Spacing[6], paddingVertical: Spacing[3], borderRadius: BorderRadius.full, marginTop: Spacing[2] },
  createBtnText: { ...Typography.labelLarge },

  modalOverlay:  { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'],
    padding: Spacing[6], paddingBottom: Spacing[10], gap: Spacing[4],
  },
  modalCloseBtn: {
    position: 'absolute', top: Spacing[4], right: Spacing[4],
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  modalCloseBtnText: { fontSize: 14 },

  modeToggle: { flexDirection: 'row', borderRadius: BorderRadius.xl, overflow: 'hidden', padding: 4, gap: 4 },
  modeBtn:    { flex: 1, alignItems: 'center', paddingVertical: Spacing[2.5], borderRadius: BorderRadius.lg },
  modeBtnText:{ ...Typography.labelLarge },

  modalSub:  { ...Typography.titleSmall, textAlign: 'center' },
  modalHint: { ...Typography.caption, textAlign: 'center', marginTop: -Spacing[2] },

  errorBox:  { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText: { ...Typography.bodySmall },

  depositInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2] },
  depositSymbol:   { ...Typography.headingSmall },
  depositInput:    { fontSize: 40, fontWeight: '700', minWidth: 120, textAlign: 'center' },

  modalActions: { flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[2] },
});
