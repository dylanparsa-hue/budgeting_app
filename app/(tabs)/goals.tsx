/**
 * Goals Screen — three tabs:
 *   "Goals"          — savings goals (existing)
 *   "Debts"          — debt tracker with time priority
 *   "Financial Plan" — income breakdown, fixed obligations, smart recs (moved from plan.tsx)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, parseISO, isPast } from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useGoalStore }        from '../../src/stores/goalStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useRecurringStore }   from '../../src/stores/recurringStore';
import { useDebtStore }        from '../../src/stores/debtStore';
import { Button }              from '../../src/components/ui/Button';
import { ProgressBar }         from '../../src/components/ui/ProgressBar';
import { useTheme }            from '../../src/theme/ThemeContext';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency, parseCurrencyInput } from '../../src/utils/currency';
import { Debt, RecurringExpense } from '../../src/types';
import { Plus, Target, Sparkles, CreditCard, Pencil, Trash2 } from 'lucide-react-native';

type ModalMode = 'add' | 'withdraw';
type Tab       = 'Goals' | 'Debts' | 'Financial Plan';

// ─── Financial Plan helpers (from plan.tsx) ───────────────────────────────────

const CAT_META: Record<string, { icon: string; color: string }> = {
  rent:         { icon: '🏠', color: '#6366f1' },
  utilities:    { icon: '💡', color: '#f59e0b' },
  subscription: { icon: '📱', color: '#8b5cf6' },
  debt:         { icon: '💳', color: '#ef4444' },
  insurance:    { icon: '🛡️', color: '#3b82f6' },
  transport:    { icon: '🚗', color: '#10b981' },
  other:        { icon: '📦', color: '#6b7280' },
};

function toMonthly(amount: number, frequency: string) {
  if (frequency === 'weekly') return amount * 52 / 12;
  if (frequency === 'yearly') return amount / 12;
  return amount;
}

function buildRecommendations(params: {
  income: number; fixedTotal: number; variableSpent: number;
  items: RecurringExpense[]; currency: string;
}) {
  const { income, fixedTotal, variableSpent, items, currency } = params;
  const tips: { icon: string; title: string; body: string; type: 'danger' | 'warning' | 'success' | 'info' }[] = [];

  if (income === 0) {
    tips.push({ icon: '💡', type: 'info', title: 'Add your income first',
      body: 'Log an income transaction this month so we can calculate how much you have available.' });
    return tips;
  }

  const totalOut   = fixedTotal + variableSpent;
  const saveable   = income - totalOut;
  const savingsPct = saveable / income;
  const savingsTarget = income * 0.20;

  if (fixedTotal > income * 0.50) {
    tips.push({ icon: '⚠️', type: 'danger', title: 'Fixed expenses too high',
      body: `Your fixed obligations (${formatCurrency(fixedTotal, currency)}/mo) exceed 50% of income. Try to reduce or renegotiate at least one bill.` });
  }
  if (saveable < 0) {
    tips.push({ icon: '🚨', type: 'danger', title: 'Spending exceeds income',
      body: `You're spending ${formatCurrency(Math.abs(saveable), currency)} more than you earn. Cut variable expenses immediately.` });
  } else if (savingsPct < 0.05) {
    tips.push({ icon: '⚠️', type: 'warning', title: 'Almost nothing left to save',
      body: `Only ${formatCurrency(saveable, currency)} remains. Aim to save at least ${formatCurrency(savingsTarget, currency)} (20% of income).` });
  } else if (savingsPct >= 0.20) {
    tips.push({ icon: '✅', type: 'success', title: 'Great savings rate!',
      body: `You're saving ${(savingsPct * 100).toFixed(0)}% of your income. Consider putting the surplus into a savings goal.` });
  }

  const subs = items.filter(i => i.category === 'subscription');
  const subTotal = subs.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  if (subs.length >= 3) {
    tips.push({ icon: '📱', type: 'warning', title: `${subs.length} active subscriptions`,
      body: `You're paying ${formatCurrency(subTotal, currency)}/mo on subscriptions. Review which ones you actually use.` });
  }

  const debts = items.filter(i => i.category === 'debt');
  const debtTotal = debts.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  if (debtTotal / income > 0.30) {
    tips.push({ icon: '💳', type: 'danger', title: 'High debt-to-income ratio',
      body: `Debt payments are ${(debtTotal / income * 100).toFixed(0)}% of income. Prioritise paying off the highest-interest debt first.` });
  }

  if (saveable > 0 && savingsPct < 0.20) {
    const gap = savingsTarget - saveable;
    tips.push({ icon: '🎯', type: 'info', title: `Save ${formatCurrency(savingsTarget, currency)}/mo`,
      body: `To reach the 20% savings rule you need to free up ${formatCurrency(gap, currency)}. Try reducing dining, shopping, or entertainment.` });
  }

  const varPct = variableSpent / income;
  if (varPct < 0.20 && income > 0) {
    tips.push({ icon: '🌟', type: 'success', title: 'Low day-to-day spending',
      body: `Your variable spending is only ${(varPct * 100).toFixed(0)}% of income — excellent discipline.` });
  }

  const rent = items.filter(i => i.category === 'rent');
  const rentTotal = rent.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  if (rentTotal / income > 0.35) {
    tips.push({ icon: '🏠', type: 'warning', title: 'Rent is above 35% of income',
      body: `Housing costs ${formatCurrency(rentTotal, currency)}/mo (${(rentTotal / income * 100).toFixed(0)}% of income). Consider if a cheaper option is feasible.` });
  }

  if (tips.length === 0) {
    tips.push({ icon: '💚', type: 'success', title: 'Budget looks healthy',
      body: 'Your income covers your expenses well and you have room to save. Keep tracking!' });
  }
  return tips;
}

// ─── Debt helpers ─────────────────────────────────────────────────────────────

type DebtUrgency = 'overdue' | 'critical' | 'urgent' | 'on_track' | 'no_date';

function getDebtUrgency(dueDate: string | null): DebtUrgency {
  if (!dueDate) return 'no_date';
  try {
    const due = parseISO(dueDate);
    if (isPast(due)) return 'overdue';
    const days = differenceInDays(due, new Date());
    if (days <= 7)  return 'critical';
    if (days <= 30) return 'urgent';
    return 'on_track';
  } catch {
    return 'no_date';
  }
}

const URGENCY_META: Record<DebtUrgency, { label: string; bg: string; text: string; icon: string }> = {
  overdue:  { label: 'Overdue',        bg: '#fecaca', text: '#991b1b', icon: '🚨' },
  critical: { label: 'Due very soon',  bg: '#fee2e2', text: '#dc2626', icon: '⚠️' },
  urgent:   { label: 'Due this month', bg: '#fef3c7', text: '#92400e', icon: '⏰' },
  on_track: { label: 'On track',       bg: '#d1fae5', text: '#065f46', icon: '✅' },
  no_date:  { label: 'No due date',    bg: '#f3f4f6', text: '#6b7280', icon: '📅' },
};

function DebtCard({ debt, currency, C, onEdit, onPay }: {
  debt: Debt; currency: string; C: any;
  onEdit: () => void; onPay: () => void;
}) {
  const urgency  = getDebtUrgency(debt.dueDate);
  const meta     = URGENCY_META[urgency];
  const remaining = Math.max(debt.totalAmount - debt.amountPaid, 0);
  const pct       = debt.totalAmount > 0 ? Math.min((debt.amountPaid / debt.totalAmount) * 100, 100) : 0;
  const isPaid    = remaining <= 0;

  let daysLabel = '';
  if (debt.dueDate) {
    try {
      const due = parseISO(debt.dueDate);
      const days = differenceInDays(due, new Date());
      if (days < 0)       daysLabel = `${Math.abs(days)}d overdue`;
      else if (days === 0) daysLabel = 'Due today';
      else                daysLabel = `${days}d left`;
    } catch {}
  }

  return (
    <View style={[debtStyles.card, Shadow.sm, { backgroundColor: C.surface }]}>
      {/* Top row: icon + name + urgency pill */}
      <View style={debtStyles.topRow}>
        <View style={[debtStyles.iconBox, { backgroundColor: meta.bg }]}>
          <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[debtStyles.debtName, { color: C.textPrimary }]} numberOfLines={1}>{debt.name}</Text>
          <Text style={[debtStyles.lender, { color: C.textTertiary }]}>To: {debt.lender}</Text>
        </View>
        {isPaid ? (
          <View style={[debtStyles.pill, { backgroundColor: '#d1fae5' }]}>
            <Text style={[debtStyles.pillText, { color: '#065f46' }]}>✓ Paid off</Text>
          </View>
        ) : (
          <View style={[debtStyles.pill, { backgroundColor: meta.bg }]}>
            <Text style={[debtStyles.pillText, { color: meta.text }]}>
              {daysLabel || meta.label}
            </Text>
          </View>
        )}
      </View>

      {/* Amounts */}
      <View style={debtStyles.amtRow}>
        <View>
          <Text style={[debtStyles.amtLabel, { color: C.textTertiary }]}>Remaining</Text>
          <Text style={[debtStyles.amtValue, { color: isPaid ? '#065f46' : C.danger }]}>
            {isPaid ? '—' : formatCurrency(remaining, currency)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[debtStyles.amtLabel, { color: C.textTertiary }]}>Total</Text>
          <Text style={[debtStyles.amtValue, { color: C.textSecondary }]}>{formatCurrency(debt.totalAmount, currency)}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ gap: 4 }}>
        <ProgressBar progress={pct} color={isPaid ? '#10b981' : meta.text} height={6} animated />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[debtStyles.progressLabel, { color: C.textTertiary }]}>
            {pct.toFixed(0)}% paid
          </Text>
          {debt.interestRate != null && (
            <Text style={[debtStyles.progressLabel, { color: C.textTertiary }]}>
              {debt.interestRate}% p.a.
            </Text>
          )}
        </View>
      </View>

      {/* Due date */}
      {debt.dueDate && !isPaid && (
        <View style={[debtStyles.dueDateRow, { backgroundColor: meta.bg + '80' }]}>
          <Text style={[debtStyles.dueDateText, { color: meta.text }]}>
            📅 Due {format(parseISO(debt.dueDate), 'dd MMM yyyy')}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={debtStyles.actionsRow}>
        <TouchableOpacity onPress={onEdit} style={[debtStyles.actionBtn, { backgroundColor: C.surfaceRaised, flex: 1 }]}>
          <Pencil size={13} color={C.textSecondary} strokeWidth={2.5} />
          <Text style={[debtStyles.actionBtnText, { color: C.textSecondary }]}>Edit</Text>
        </TouchableOpacity>
        {!isPaid && (
          <TouchableOpacity onPress={onPay} style={[debtStyles.actionBtn, { backgroundColor: '#0E2417', flex: 1.5 }]}>
            <Text style={[debtStyles.actionBtnText, { color: '#9FE870' }]}>💰  Make Payment</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── GoalCard sub-component ───────────────────────────────────────────────────

function GoalCard({
  goal, C, currency, onAddFunds,
}: {
  goal: any; C: any; currency: string; onAddFunds: () => void;
}) {
  const pct       = goal.target_amount > 0 ? Math.min(goal.current_amount / goal.target_amount * 100, 100) : 0;
  const remaining = goal.target_amount - goal.current_amount;

  return (
    <View style={[styles.goalCard, { backgroundColor: C.surface }, Shadow.sm]}>
      <View style={styles.goalTopRow}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
          <View style={[styles.goalIconBox, { backgroundColor: C.surfaceRaised }]}>
            <Text style={{ fontSize: 22 }}>{goal.icon ?? '🎯'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{goal.name}</Text>
            <Text style={{ ...Typography.caption, color: C.textTertiary }}>
              {goal.deadline ? format(new Date(goal.deadline), 'MMM yyyy') : 'No deadline'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onAddFunds}
          style={[styles.goalAddBtn, { backgroundColor: C.primary }]}
        >
          <Plus size={16} color={C.black} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.goalAmtRow}>
        <Text style={[styles.goalAmt, { color: C.textPrimary }]}>
          {formatCurrency(goal.current_amount, currency)}
        </Text>
        <Text style={{ ...Typography.bodySmall, color: C.textTertiary }}>
          / {formatCurrency(goal.target_amount, currency)}
        </Text>
      </View>

      <ProgressBar progress={pct} color={C.primary} height={6} animated />

      <View style={styles.goalFooter}>
        <Text style={styles.goalFooterText}>{pct.toFixed(0)}% SAVED</Text>
        <Text style={styles.goalFooterText}>{formatCurrency(remaining, currency)} TO GO</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const C = useTheme();
  const { user, profile }                               = useAuthStore();
  const { goals, loadGoals, depositToGoal, updateGoal } = useGoalStore();
  const { addTransaction, categories, transactions }    = useTransactionStore();
  const { items: recurringItems, load: loadRecurring, remove: removeRecurring } = useRecurringStore();
  const { debts, load: loadDebts }                      = useDebtStore();

  const [activeTab,   setActiveTab]   = useState<Tab>('Goals');
  const [refreshing,  setRefreshing]  = useState(false);
  const [modalGoalId, setModalGoalId] = useState<string | null>(null);
  const [modalMode,   setModalMode]   = useState<ModalMode>('add');
  const [amount,      setAmount]      = useState('');
  const [amountError, setAmountError] = useState('');
  const [isSaving,    setIsSaving]    = useState(false);

  // Debt payment modal state
  const [payDebtId,     setPayDebtId]     = useState<string | null>(null);
  const [payAmountStr,  setPayAmountStr]  = useState('');
  const [payAmountErr,  setPayAmountErr]  = useState('');
  const [isPaySaving,   setIsPaySaving]   = useState(false);
  const { pay: payDebt } = useDebtStore();

  const currency  = profile?.currency ?? 'MYR';
  const modalGoal = goals.find(g => g.id === modalGoalId);
  const payDebt_  = debts.find(d => d.id === payDebtId);

  useEffect(() => {
    if (user) loadGoals(user.id);
    loadRecurring();
    loadDebts();
  }, [user?.id]);

  // ── Financial Plan calculations ───────────────────────────────────────────
  const now        = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => startOfMonth(now), [now]);
  const monthEnd   = useMemo(() => endOfMonth(now), [now]);

  const monthIncome = useMemo(() =>
    transactions
      .filter(t => t.type === 'income' && isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd }))
      .reduce((s, t) => s + t.amount, 0),
  [transactions, monthStart, monthEnd]);

  const monthExpenses = useMemo(() =>
    transactions
      .filter(t => t.type === 'expense' && isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd }))
      .reduce((s, t) => s + t.amount, 0),
  [transactions, monthStart, monthEnd]);

  const fixedMonthly = useMemo(() =>
    recurringItems.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0),
  [recurringItems]);

  const saveable = monthIncome - fixedMonthly - monthExpenses;

  const planTips = useMemo(() => buildRecommendations({
    income: monthIncome, fixedTotal: fixedMonthly,
    variableSpent: monthExpenses, items: recurringItems, currency,
  }), [monthIncome, fixedMonthly, monthExpenses, recurringItems, currency]);

  const tipColors = {
    danger:  { bg: C.dangerLight,  text: C.danger  },
    warning: { bg: '#fef3c7',      text: '#92400e' },
    success: { bg: '#d1fae5',      text: '#065f46' },
    info:    { bg: C.primaryLight, text: C.primary  },
  };

  // ── Goals helpers ─────────────────────────────────────────────────────────
  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await loadGoals(user.id);
    setRefreshing(false);
  };

  const openModal = (goalId: string, mode: ModalMode) => {
    setModalGoalId(goalId); setModalMode(mode);
    setAmount(''); setAmountError('');
  };
  const closeModal = () => { setModalGoalId(null); setAmount(''); setAmountError(''); };

  const handleConfirm = async () => {
    if (!modalGoalId || !user || !modalGoal) return;
    const parsed = parseCurrencyInput(amount);
    if (parsed <= 0) { setAmountError('Please enter a valid amount.'); return; }
    setIsSaving(true); setAmountError('');
    try {
      if (modalMode === 'add') {
        const canAdd = modalGoal.target_amount - modalGoal.current_amount;
        if (parsed > canAdd) { setAmountError(`Max you can add is ${formatCurrency(canAdd, currency)}`); return; }
        await depositToGoal(modalGoalId, parsed);
        const expCat = categories.find(c =>
          /saving|invest|transfer/i.test(c.name) && (c.type === 'expense' || c.type === 'both')
        ) ?? categories.find(c => c.type === 'expense' || c.type === 'both') ?? categories[0];
        await addTransaction(user.id, {
          type: 'expense', amount: parsed, date: format(new Date(), 'yyyy-MM-dd'),
          category_id: expCat?.id ?? null, note: `Savings: ${modalGoal.name}`,
          payment_method: 'transfer', tags: ['savings'], is_recurring: false, group_id: null, user_id: user.id,
        });
      } else {
        if (parsed > modalGoal.current_amount) {
          setAmountError(`You only have ${formatCurrency(modalGoal.current_amount, currency)} saved`); return;
        }
        const newSaved = modalGoal.current_amount - Math.min(parsed, modalGoal.current_amount);
        const incomeCat = categories.find(c => c.type === 'income' || c.type === 'both') ?? categories[0];
        await addTransaction(user.id, {
          type: 'income', amount: parsed, date: format(new Date(), 'yyyy-MM-dd'),
          category_id: incomeCat?.id ?? null, note: `Withdrawal: ${modalGoal.name}`,
          payment_method: 'transfer', tags: ['savings'], is_recurring: false, group_id: null, user_id: user.id,
        });
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
  const overallPct     = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  // Debt helpers
  const urgencyOrder: Record<DebtUrgency, number> = { overdue: 0, critical: 1, urgent: 2, on_track: 3, no_date: 4 };
  const sortedDebts = useMemo(() =>
    [...debts].sort((a, b) => {
      const ua = getDebtUrgency(a.dueDate);
      const ub = getDebtUrgency(b.dueDate);
      return urgencyOrder[ua] - urgencyOrder[ub];
    }),
  [debts]);
  const activeDebts    = sortedDebts.filter(d => d.amountPaid < d.totalAmount);
  const paidOffDebts   = sortedDebts.filter(d => d.amountPaid >= d.totalAmount);
  const totalDebt      = debts.reduce((s, d) => s + Math.max(d.totalAmount - d.amountPaid, 0), 0);

  const handlePayDebt = async () => {
    if (!payDebtId || !payDebt_) return;
    const parsed = parseCurrencyInput(payAmountStr);
    if (parsed <= 0) { setPayAmountErr('Please enter a valid amount.'); return; }
    const maxPay = payDebt_.totalAmount - payDebt_.amountPaid;
    if (parsed > maxPay) { setPayAmountErr(`Max payment is ${formatCurrency(maxPay, currency)}`); return; }
    setIsPaySaving(true); setPayAmountErr('');
    try {
      await payDebt(payDebtId, parsed);
      setPayDebtId(null); setPayAmountStr(''); setPayAmountErr('');
    } catch (err: any) {
      setPayAmountErr(err?.message ?? 'Something went wrong.');
    } finally {
      setIsPaySaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: C.textPrimary }]}>Goals</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>Savings, debts & financial plan.</Text>
        </View>
        {activeTab === 'Goals' && (
          <TouchableOpacity onPress={() => router.push('/modals/add-goal')} style={[styles.addBtn, { borderColor: C.border }]}>
            <View style={styles.addBtnInner}>
              <Plus size={14} color={C.textPrimary} strokeWidth={2.5} />
              <Text style={[styles.addBtnText, { color: C.textPrimary }]}>Add</Text>
            </View>
          </TouchableOpacity>
        )}
        {activeTab === 'Debts' && (
          <TouchableOpacity onPress={() => router.push('/modals/add-debt' as any)} style={[styles.addBtn, { borderColor: C.border }]}>
            <View style={styles.addBtnInner}>
              <Plus size={14} color={C.textPrimary} strokeWidth={2.5} />
              <Text style={[styles.addBtnText, { color: C.textPrimary }]}>Debt</Text>
            </View>
          </TouchableOpacity>
        )}
        {activeTab === 'Financial Plan' && (
          <TouchableOpacity onPress={() => router.push('/modals/add-recurring')} style={[styles.addBtn, { borderColor: C.border }]}>
            <View style={styles.addBtnInner}>
              <Plus size={14} color={C.textPrimary} strokeWidth={2.5} />
              <Text style={[styles.addBtnText, { color: C.textPrimary }]}>Bill</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: C.surfaceRaised }]}>
        {(['Goals', 'Debts', 'Financial Plan'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              activeTab === tab && [styles.tabBtnActive, { backgroundColor: C.surface }, Shadow.sm],
            ]}
          >
            {tab === 'Debts' && (
              <CreditCard size={11} color={activeTab === tab ? C.danger : C.textTertiary} strokeWidth={2} />
            )}
            {tab === 'Financial Plan' && (
              <Sparkles size={11} color={activeTab === tab ? C.primary : C.textTertiary} strokeWidth={2} />
            )}
            <Text style={[
              styles.tabLabel,
              { color: activeTab === tab ? C.textPrimary : C.textTertiary },
              activeTab === tab && { fontWeight: '700' },
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {activeTab === 'Goals' ? (
          /* ══════════ GOALS TAB ══════════ */
          <>
            {/* Summary banner */}
            {goals.length > 0 && (
              <View style={[styles.summaryBanner, { backgroundColor: C.primaryLight }, Shadow.sm]}>
                <View style={[styles.summaryIconBox, { backgroundColor: C.primary }]}>
                  <Target size={22} color={C.black} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.summaryOverline, { color: C.primaryDark }]}>SAVED SO FAR</Text>
                  <Text style={[styles.summaryAmt, { color: C.textPrimary }]}>
                    {formatCurrency(totalSaved, currency)}
                  </Text>
                  <Text style={[styles.summarySub, { color: C.textSecondary }]}>
                    Across {activeGoals.length} goal{activeGoals.length !== 1 ? 's' : ''} · {overallPct.toFixed(0)}% there
                  </Text>
                </View>
              </View>
            )}

            {/* Smart Savings Planner banner */}
            <TouchableOpacity
              onPress={() => router.push('/modals/savings-planner' as any)}
              style={[styles.plannerBanner, { backgroundColor: C.primary }]}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.plannerTitle}>🎯 Smart Savings Planner</Text>
                <Text style={styles.plannerSub}>See how much to save per goal each month</Text>
              </View>
              <View style={[styles.plannerArrow, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                <Text style={styles.plannerArrowText}>→</Text>
              </View>
            </TouchableOpacity>

            {/* Active goals */}
            {activeGoals.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Active goals</Text>
                </View>
                <View style={styles.goalsList}>
                  {activeGoals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} C={C} currency={currency}
                      onAddFunds={() => openModal(goal.id, 'add')} />
                  ))}
                </View>
              </>
            )}

            {/* Completed goals */}
            {completedGoals.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>🏆 Completed</Text>
                </View>
                <View style={styles.goalsList}>
                  {completedGoals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} C={C} currency={currency}
                      onAddFunds={() => openModal(goal.id, 'add')} />
                  ))}
                </View>
              </>
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
          </>
        ) : activeTab === 'Debts' ? (
          /* ══════════ DEBTS TAB ══════════ */
          <View style={styles.planContent}>

            {/* Summary banner */}
            {debts.length > 0 && (
              <View style={[debtStyles.summaryCard, Shadow.sm, { backgroundColor: C.surface }]}>
                <View style={[debtStyles.summaryLeft, { backgroundColor: totalDebt > 0 ? '#fef2f2' : '#d1fae5' }]}>
                  <Text style={[debtStyles.summaryLabelSmall, { color: totalDebt > 0 ? '#991b1b' : '#065f46' }]}>
                    TOTAL OWED
                  </Text>
                  <Text style={[debtStyles.summaryAmount, { color: totalDebt > 0 ? C.danger : '#10b981' }]}>
                    {totalDebt > 0 ? formatCurrency(totalDebt, currency) : 'All clear! 🎉'}
                  </Text>
                </View>
                <View style={debtStyles.summaryRight}>
                  <Text style={[debtStyles.summaryStatLabel, { color: C.textTertiary }]}>Active</Text>
                  <Text style={[debtStyles.summaryStatVal, { color: C.textPrimary }]}>{activeDebts.length}</Text>
                  <Text style={[debtStyles.summaryStatLabel, { color: C.textTertiary, marginTop: 4 }]}>Paid off</Text>
                  <Text style={[debtStyles.summaryStatVal, { color: '#10b981' }]}>{paidOffDebts.length}</Text>
                </View>
              </View>
            )}

            {/* Priority legend */}
            {activeDebts.length > 0 && (
              <View style={[debtStyles.legendCard, { backgroundColor: C.surface }]}>
                <Text style={[debtStyles.legendTitle, { color: C.textSecondary }]}>TIME PRIORITY</Text>
                <View style={debtStyles.legendRow}>
                  {(['overdue','critical','urgent','on_track'] as DebtUrgency[]).map(u => {
                    const m = URGENCY_META[u];
                    return (
                      <View key={u} style={[debtStyles.legendPill, { backgroundColor: m.bg }]}>
                        <Text style={{ fontSize: 10 }}>{m.icon}</Text>
                        <Text style={[debtStyles.legendPillText, { color: m.text }]}>{m.label.split(' ')[0]}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Active debts */}
            {activeDebts.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Active debts</Text>
                </View>
                <View style={{ gap: 12 }}>
                  {activeDebts.map(debt => (
                    <DebtCard
                      key={debt.id} debt={debt} currency={currency} C={C}
                      onEdit={() => router.push(`/modals/add-debt?id=${debt.id}` as any)}
                      onPay={() => { setPayDebtId(debt.id); setPayAmountStr(''); setPayAmountErr(''); }}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Paid off debts */}
            {paidOffDebts.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>🏆 Paid off</Text>
                </View>
                <View style={{ gap: 12 }}>
                  {paidOffDebts.map(debt => (
                    <DebtCard
                      key={debt.id} debt={debt} currency={currency} C={C}
                      onEdit={() => router.push(`/modals/add-debt?id=${debt.id}` as any)}
                      onPay={() => {}}
                    />
                  ))}
                </View>
              </>
            )}

            {debts.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>💳</Text>
                <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No debts tracked</Text>
                <Text style={[styles.emptyText, { color: C.textTertiary }]}>
                  Track loans, credit cards or money you owe anyone — with due dates and time priority
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/modals/add-debt' as any)}
                  style={[styles.createBtn, { backgroundColor: '#fef2f2' }]}
                >
                  <Text style={[styles.createBtnText, { color: C.danger }]}>Track a Debt</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        ) : (
          /* ══════════ FINANCIAL PLAN TAB ══════════ */
          <View style={styles.planContent}>

            {/* Overview card */}
            <View style={[styles.overviewCard, Shadow.md, { backgroundColor: C.surface }]}>
              <PlanRow label="Monthly income"    value={formatCurrency(monthIncome, currency)}    color={C.success}  C={C} />
              <View style={[styles.planDivider, { backgroundColor: C.border }]} />
              <PlanRow label="Fixed obligations" value={`− ${formatCurrency(fixedMonthly, currency)}`} color={C.danger}   C={C} />
              <View style={[styles.planDivider, { backgroundColor: C.border }]} />
              <PlanRow label="Variable spending" value={`− ${formatCurrency(monthExpenses, currency)}`} color={C.textSecondary} C={C} />
              <View style={[styles.planDivider, { backgroundColor: C.border }]} />
              <PlanRow label="Left to save" bold
                value={formatCurrency(Math.max(saveable, 0), currency)}
                color={saveable >= 0 ? C.primary : C.danger} C={C} />
            </View>

            {/* Income allocation bar */}
            {monthIncome > 0 && (
              <View style={[styles.barCard, Shadow.sm, { backgroundColor: C.surface }]}>
                <Text style={[styles.barLabel, { color: C.textSecondary }]}>Income allocation</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barSeg, { flex: Math.min(fixedMonthly / monthIncome, 1),        backgroundColor: '#ef4444' }]} />
                  <View style={[styles.barSeg, { flex: Math.min(monthExpenses / monthIncome, Math.max(1 - fixedMonthly / monthIncome, 0)), backgroundColor: '#f59e0b' }]} />
                  <View style={[styles.barSeg, { flex: Math.max(1 - fixedMonthly / monthIncome - monthExpenses / monthIncome, 0), backgroundColor: '#10b981' }]} />
                </View>
                <View style={styles.barLegend}>
                  {[['#ef4444','Fixed'],['#f59e0b','Variable'],['#10b981','Remaining']].map(([color, label]) => (
                    <View key={label} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: color }]} />
                      <Text style={{ fontSize: 11, color: C.textTertiary }}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Fixed obligations */}
            <View style={styles.planSection}>
              <View style={styles.planSectionHeader}>
                <Text style={[styles.planSectionTitle, { color: C.textPrimary }]}>Fixed Obligations</Text>
                <TouchableOpacity onPress={() => router.push('/modals/add-recurring')}>
                  <Text style={[styles.planSectionAction, { color: C.primary }]}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {recurringItems.length === 0 ? (
                <TouchableOpacity
                  onPress={() => router.push('/modals/add-recurring')}
                  style={[styles.planEmpty, { backgroundColor: C.surface, borderColor: C.border }]}
                >
                  <Text style={styles.planEmptyIcon}>📋</Text>
                  <Text style={[styles.planEmptyTitle, { color: C.textSecondary }]}>No fixed expenses yet</Text>
                  <Text style={[styles.planEmptyText, { color: C.textTertiary }]}>
                    Add rent, bills, subscriptions and debts to see your true disposable income
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.recurringList}>
                  {recurringItems.map(item => {
                    const meta    = CAT_META[item.category] ?? CAT_META.other;
                    const monthly = toMonthly(item.amount, item.frequency);
                    return (
                      <View key={item.id} style={[styles.recurringCard, Shadow.sm, { backgroundColor: C.surface }]}>
                        <View style={[styles.recurringIcon, { backgroundColor: meta.color + '20' }]}>
                          <Text style={styles.recurringEmoji}>{meta.icon}</Text>
                        </View>
                        <View style={styles.recurringInfo}>
                          <Text style={[styles.recurringName, { color: C.textPrimary }]}>{item.name}</Text>
                          <Text style={[styles.recurringFreq, { color: C.textTertiary }]}>
                            {item.frequency === 'monthly' ? 'Monthly' : item.frequency === 'weekly' ? 'Weekly' : 'Yearly'}
                          </Text>
                        </View>
                        <View style={styles.recurringRight}>
                          <Text style={[styles.recurringAmt, { color: C.textPrimary }]}>
                            {formatCurrency(item.amount, currency)}
                          </Text>
                          {item.frequency !== 'monthly' && (
                            <Text style={[styles.recurringMonthly, { color: C.textTertiary }]}>
                              {formatCurrency(monthly, currency)}/mo
                            </Text>
                          )}
                        </View>
                        <View style={styles.recurringActions}>
                          <TouchableOpacity
                            onPress={() => router.push(`/modals/add-recurring?id=${item.id}`)}
                            style={[styles.actionBtn, { backgroundColor: C.primaryLight }]}
                          >
                            <Pencil size={13} color={C.primary} strokeWidth={2.5} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => removeRecurring(item.id)}
                            style={[styles.actionBtn, { backgroundColor: C.dangerLight }]}
                          >
                            <Trash2 size={13} color={C.danger} strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => router.push('/modals/add-recurring')}
                    style={[styles.addMoreBtn, { borderColor: C.border }]}
                  >
                    <Text style={[styles.addMoreText, { color: C.primary }]}>+ Add another</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Smart recommendations */}
            <View style={styles.planSection}>
              <Text style={[styles.planSectionTitle, { color: C.textPrimary }]}>Smart Recommendations</Text>
              <View style={styles.tipList}>
                {planTips.map((tip, i) => {
                  const colors = tipColors[tip.type];
                  return (
                    <View key={i} style={[styles.tipCard, { backgroundColor: colors.bg }]}>
                      <Text style={styles.tipIcon}>{tip.icon}</Text>
                      <View style={styles.tipBody}>
                        <Text style={[styles.tipTitle, { color: colors.text }]}>{tip.title}</Text>
                        <Text style={[styles.tipText,  { color: colors.text + 'cc' }]}>{tip.body}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Debt payment modal */}
      <Modal visible={!!payDebtId} transparent animationType="slide" onRequestClose={() => setPayDebtId(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPayDebtId(null)} />
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <TouchableOpacity onPress={() => setPayDebtId(null)} style={[styles.modalCloseBtn, { backgroundColor: C.surfaceRaised }]}>
              <Text style={[styles.modalCloseBtnText, { color: C.textSecondary }]}>✕</Text>
            </TouchableOpacity>

            <Text style={[styles.modalSub, { color: C.textPrimary, marginTop: Spacing[2] }]}>💰 Make Payment</Text>
            <Text style={[styles.modalHint, { color: C.textSecondary }]}>
              {payDebt_?.name} · {payDebt_ ? formatCurrency(Math.max(payDebt_.totalAmount - payDebt_.amountPaid, 0), currency) : ''} remaining
            </Text>

            {payAmountErr ? (
              <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
                <Text style={[styles.errorText, { color: C.danger }]}>{payAmountErr}</Text>
              </View>
            ) : null}

            <View style={styles.depositInputRow}>
              <Text style={[styles.depositSymbol, { color: C.textSecondary }]}>{currency === 'MYR' ? 'RM' : currency}</Text>
              <TextInput
                value={payAmountStr}
                onChangeText={v => { setPayAmountStr(v); setPayAmountErr(''); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.textTertiary}
                style={[styles.depositInput, { color: C.textPrimary }]}
                autoFocus returnKeyType="done" onSubmitEditing={handlePayDebt}
              />
            </View>

            <View style={styles.modalActions}>
              <Button label="Cancel" variant="ghost" onPress={() => setPayDebtId(null)} style={{ flex: 1 }} disabled={isPaySaving} />
              <Button label={isPaySaving ? 'Saving…' : 'Record Payment'} onPress={handlePayDebt} loading={isPaySaving} style={{ flex: 1.5 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add / Withdraw modal */}
      <Modal visible={!!modalGoalId} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} />
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <TouchableOpacity onPress={closeModal} style={[styles.modalCloseBtn, { backgroundColor: C.surfaceRaised }]}>
              <Text style={[styles.modalCloseBtnText, { color: C.textSecondary }]}>✕</Text>
            </TouchableOpacity>

            <View style={[styles.modeToggle, { backgroundColor: C.surfaceRaised }]}>
              {(['add', 'withdraw'] as ModalMode[]).map(mode => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => { setModalMode(mode); setAmount(''); setAmountError(''); }}
                  style={[
                    styles.modeBtn,
                    modalMode === mode && { backgroundColor: mode === 'add' ? C.primary : C.danger },
                  ]}
                >
                  <Text style={[styles.modeBtnText, { color: modalMode === mode ? '#fff' : C.textSecondary }]}>
                    {mode === 'add' ? '↑ Add savings' : '↓ Withdraw'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalSub, { color: C.textSecondary }]}>
              {modalGoal?.icon} {modalGoal?.name}
            </Text>
            <Text style={[styles.modalHint, { color: C.textTertiary }]}>
              {modalMode === 'add'
                ? `${formatCurrency(modalGoal?.current_amount ?? 0, currency)} saved · ${formatCurrency((modalGoal?.target_amount ?? 0) - (modalGoal?.current_amount ?? 0), currency)} remaining`
                : `${formatCurrency(modalGoal?.current_amount ?? 0, currency)} available to withdraw`}
            </Text>

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
                onPress={handleConfirm} loading={isSaving} style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Debt card styles ─────────────────────────────────────────────────────────

const debtStyles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl, padding: Spacing[4], gap: Spacing[3],
    marginHorizontal: 16,
  },
  topRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  iconBox:    { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  debtName:   { ...Typography.titleSmall, fontWeight: '700' },
  lender:     { ...Typography.caption },
  pill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  pillText:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  amtRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  amtLabel:   { ...Typography.caption, marginBottom: 2 },
  amtValue:   { ...Typography.titleSmall, fontWeight: '700' },
  progressLabel: { fontSize: 11, fontWeight: '600' },
  dueDateRow: {
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    alignSelf: 'flex-start',
  },
  dueDateText: { fontSize: 12, fontWeight: '600' },
  actionsRow:  { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[1] },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing[2.5], borderRadius: BorderRadius.lg, gap: Spacing[1.5],
  },
  actionBtnText: { ...Typography.labelLarge, fontWeight: '600' },

  // Summary card
  summaryCard:  { flexDirection: 'row', borderRadius: BorderRadius.xl, overflow: 'hidden', marginHorizontal: 16, marginTop: 8 },
  summaryLeft:  { flex: 2, padding: Spacing[4], gap: Spacing[1] },
  summaryLabelSmall: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  summaryAmount:{ fontFamily: FontFamily.display, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryRight: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[4], gap: 0 },
  summaryStatLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },
  summaryStatVal:   { fontFamily: FontFamily.display, fontSize: 22, fontWeight: '800' },

  // Legend
  legendCard:  { borderRadius: BorderRadius.xl, padding: Spacing[3.5], marginHorizontal: 16, gap: Spacing[2] },
  legendTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  legendRow:   { flexDirection: 'row', gap: Spacing[1.5], flexWrap: 'wrap' },
  legendPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  legendPillText: { fontSize: 10, fontWeight: '700' },
});

// ─── Financial Plan helper components ────────────────────────────────────────

function PlanRow({ label, value, color, C, bold }: { label: string; value: string; color: string; C: any; bold?: boolean }) {
  return (
    <View style={styles.planRow}>
      <Text style={[styles.planRowLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[styles.planRowValue, { color }, bold && { fontSize: 18, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 20,
  },
  title:    { fontFamily: FontFamily.display, fontSize: 32, fontWeight: '800' },
  subtitle: { fontSize: 15, marginTop: 2 },
  addBtn:   { borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnInner: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  addBtnText:  { fontSize: 14, fontWeight: '600' },

  // Tab bar
  tabBar: {
    flexDirection: 'row', borderRadius: 12, padding: 4,
    marginHorizontal: 24, marginTop: 16, marginBottom: 4,
  },
  tabBtn:       { flex: 1, flexDirection: 'row', paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 8, gap: 5 },
  tabBtnActive: { borderRadius: 8 },
  tabLabel:     { fontSize: 13, fontWeight: '600' },

  // Goals tab
  summaryBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 20,
  },
  summaryIconBox:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryOverline: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  summaryAmt:      { fontFamily: FontFamily.display, fontSize: 28, fontWeight: '800', marginTop: 2 },
  summarySub:      { fontSize: 13, marginTop: 2 },

  plannerBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 12, borderRadius: BorderRadius.xl, padding: Spacing[4], gap: Spacing[3],
  },
  plannerTitle:     { fontSize: 15, fontWeight: '700', color: '#fff' },
  plannerSub:       { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  plannerArrow:     { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  plannerArrowText: { fontSize: 17, color: '#fff', fontWeight: '700' },

  sectionHeader: { paddingHorizontal: 24, marginTop: 24, marginBottom: 12 },
  sectionTitle:  { fontFamily: FontFamily.display, fontSize: 18, fontWeight: '700' },

  goalsList: { gap: 12, marginHorizontal: 16 },
  goalCard:  { borderRadius: 20, padding: 16, gap: 10 },
  goalTopRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalIconBox:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  goalAddBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  goalAmtRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  goalAmt:    { fontFamily: FontFamily.display, fontSize: FontSize['2xl'], fontWeight: '800', letterSpacing: -0.5 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  goalFooterText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#8A9A92' },

  empty: { alignItems: 'center', paddingVertical: Spacing[14], gap: Spacing[3] },
  emptyIcon:    { fontSize: 44 },
  emptyTitle:   { ...Typography.titleSmall },
  emptyText:    { ...Typography.bodySmall, textAlign: 'center', paddingHorizontal: Spacing[8] },
  createBtn:    { paddingHorizontal: Spacing[6], paddingVertical: Spacing[3], borderRadius: BorderRadius.full, marginTop: Spacing[2] },
  createBtnText:{ ...Typography.labelLarge },

  // Financial Plan tab
  planContent: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  overviewCard: { borderRadius: BorderRadius.xl, padding: Spacing[5], gap: Spacing[3] },
  planRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planRowLabel: { ...Typography.bodyMedium },
  planRowValue: { ...Typography.titleSmall },
  planDivider:  { height: 1 },

  barCard:   { borderRadius: BorderRadius.xl, padding: Spacing[4], gap: Spacing[3] },
  barLabel:  { ...Typography.caption },
  barTrack:  { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  barSeg:    { borderRadius: 5 },
  barLegend: { flexDirection: 'row', gap: Spacing[4] },
  legendItem:{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1.5] },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  planSection:       { gap: 12 },
  planSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planSectionTitle:  { ...Typography.titleSmall, fontWeight: '700' },
  planSectionAction: { ...Typography.labelLarge },
  planEmpty: {
    alignItems: 'center', gap: Spacing[2], padding: Spacing[6],
    borderRadius: BorderRadius.xl, borderWidth: 1, borderStyle: 'dashed',
  },
  planEmptyIcon:  { fontSize: 36 },
  planEmptyTitle: { ...Typography.titleSmall },
  planEmptyText:  { ...Typography.bodySmall, textAlign: 'center' },

  recurringList: { gap: Spacing[2] },
  recurringCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    borderRadius: BorderRadius.xl, padding: Spacing[3.5],
  },
  recurringIcon:    { width: 40, height: 40, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  recurringEmoji:   { fontSize: 20 },
  recurringInfo:    { flex: 1, gap: Spacing[0.5] },
  recurringName:    { ...Typography.labelLarge },
  recurringFreq:    { ...Typography.caption },
  recurringRight:   { alignItems: 'flex-end', gap: Spacing[0.5] },
  recurringAmt:     { ...Typography.labelLarge },
  recurringMonthly: { ...Typography.caption },
  recurringActions: { flexDirection: 'row', gap: Spacing[1.5] },
  actionBtn:        { width: 28, height: 28, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  actionIcon:       { fontSize: 13 },
  addMoreBtn: {
    alignItems: 'center', paddingVertical: Spacing[3],
    borderRadius: BorderRadius.xl, borderWidth: 1, borderStyle: 'dashed',
  },
  addMoreText: { ...Typography.labelLarge },

  tipList: { gap: Spacing[3] },
  tipCard: {
    flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start',
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  tipIcon:  { fontSize: 22, marginTop: 1 },
  tipBody:  { flex: 1, gap: Spacing[1] },
  tipTitle: { ...Typography.labelLarge },
  tipText:  { ...Typography.bodySmall, lineHeight: 20 },

  // Modal
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
  modalSub:   { ...Typography.titleSmall, textAlign: 'center' },
  modalHint:  { ...Typography.caption, textAlign: 'center', marginTop: -Spacing[2] },
  errorBox:   { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText:  { ...Typography.bodySmall },
  depositInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2] },
  depositSymbol:   { ...Typography.headingSmall },
  depositInput:    { fontSize: 40, fontWeight: '700', minWidth: 120, textAlign: 'center' },
  modalActions:    { flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[2] },
});
