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
import { format, differenceInDays, parseISO, isPast } from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useGoalStore }        from '../../src/stores/goalStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useBudgetStore }      from '../../src/stores/budgetStore';
import { useRecurringStore }   from '../../src/stores/recurringStore';
import { useDebtStore }        from '../../src/stores/debtStore';
import { Button }              from '../../src/components/ui/Button';
import { ProgressBar }         from '../../src/components/ui/ProgressBar';
import { useTheme }            from '../../src/theme/ThemeContext';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency, parseCurrencyInput } from '../../src/utils/currency';
import { CATEGORY_ICON, BILL_META } from '../../src/lib/icons';
import { Debt } from '../../src/types';
import {
  Plus, Target, CreditCard, Pencil, Trash2,
  AlertTriangle, AlertOctagon, CheckCircle2, Clock,
  Banknote, Trophy, Star, Calendar, X, BarChart2, Package,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

type ModalMode = 'add' | 'withdraw';
type Tab       = 'Budget' | 'Goals' | 'Debts';

const MONTH = new Date().getMonth() + 1;
const YEAR  = new Date().getFullYear();


function toMonthly(amount: number, frequency: string) {
  if (frequency === 'weekly') return amount * 52 / 12;
  if (frequency === 'yearly') return amount / 12;
  return amount;
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

const URGENCY_META: Record<DebtUrgency, { label: string; bg: string; text: string; Icon: LucideIcon }> = {
  overdue:  { label: 'Overdue',        bg: '#fecaca', text: '#991b1b', Icon: AlertOctagon  },
  critical: { label: 'Due very soon',  bg: '#fee2e2', text: '#dc2626', Icon: AlertTriangle  },
  urgent:   { label: 'Due this month', bg: '#fef3c7', text: '#92400e', Icon: Clock          },
  on_track: { label: 'On track',       bg: '#d1fae5', text: '#065f46', Icon: CheckCircle2   },
  no_date:  { label: 'No due date',    bg: '#f3f4f6', text: '#6b7280', Icon: Calendar       },
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
          <meta.Icon size={20} color={meta.text} strokeWidth={2} />
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
        <View style={[debtStyles.dueDateRow, { backgroundColor: meta.bg + '80', flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
          <Calendar size={12} color={meta.text} strokeWidth={2} />
          <Text style={[debtStyles.dueDateText, { color: meta.text }]}>
            Due {format(parseISO(debt.dueDate), 'dd MMM yyyy')}
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
            <Banknote size={13} color="#9FE870" strokeWidth={2} />
            <Text style={[debtStyles.actionBtnText, { color: '#9FE870' }]}>Make Payment</Text>
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
            {(() => {
              const { GOAL_ICON: GI } = require('../../src/lib/icons');
              const GoalIc: LucideIcon = GI[goal.icon ?? ''] ?? Target;
              return <GoalIc size={22} color={C.primary} strokeWidth={2} />;
            })()}
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
  const { budgets, loadBudgets, removeBudget }          = useBudgetStore();
  const { items: recurringItems, load: loadRecurring, remove: removeRecurring } = useRecurringStore();
  const { debts, load: loadDebts }                      = useDebtStore();

  const [activeTab,   setActiveTab]   = useState<Tab>('Budget');
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
    if (user) {
      loadGoals(user.id);
      loadBudgets(user.id, MONTH, YEAR);
    }
    loadRecurring();
    loadDebts();
  }, [user?.id]);

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
        // ── Balance protection ───────────────────────────────────────────────
        if (currentBalance < parsed) {
          setAmountError(
            `Insufficient available balance. You have ${formatCurrency(Math.max(currentBalance, 0), currency)} available.`
          );
          return;
        }
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

  // All-time balance (income − expenses across all transactions)
  const currentBalance = useMemo(() => {
    let bal = 0;
    for (const t of transactions) {
      if (t.type === 'income') bal += t.amount;
      else bal -= t.amount;
    }
    return bal;
  }, [transactions]);

  const budgetsWithSpend = useMemo(() => budgets.map(b => ({
    ...b,
    spent: transactions
      .filter(t =>
        t.type === 'expense' && t.category_id === b.category_id &&
        new Date(t.date).getMonth() + 1 === MONTH && new Date(t.date).getFullYear() === YEAR,
      )
      .reduce((s, t) => s + t.amount, 0),
  })), [budgets, transactions]);

  // Debt helpers
  const urgencyOrder: Record<DebtUrgency, number> = { overdue: 0, critical: 1, urgent: 2, on_track: 3, no_date: 4 };
  const sortedDebts = useMemo(() =>
    [...debts].sort((a, b) => {
      const ua = getDebtUrgency(a.dueDate);
      const ub = getDebtUrgency(b.dueDate);
      return urgencyOrder[ua] - urgencyOrder[ub];
    }),
  [debts]);
  const activeDebts  = sortedDebts.filter(d => d.amountPaid < d.totalAmount);
  const paidOffDebts = sortedDebts.filter(d => d.amountPaid >= d.totalAmount);
  const totalDebt    = debts.reduce((s, d) => s + Math.max(d.totalAmount - d.amountPaid, 0), 0);

  const handlePayDebt = async () => {
    if (!payDebtId || !payDebt_ || !user) return;
    const parsed = parseCurrencyInput(payAmountStr);
    if (parsed <= 0) { setPayAmountErr('Please enter a valid amount.'); return; }
    const maxPay = payDebt_.totalAmount - payDebt_.amountPaid;
    if (parsed > maxPay) { setPayAmountErr(`Max payment is ${formatCurrency(maxPay, currency)}`); return; }

    // Balance check — payment must come from real money
    if (currentBalance < parsed) {
      setPayAmountErr(
        `Not enough balance. You have ${formatCurrency(Math.max(currentBalance, 0), currency)} available.\nAdd income first to cover this payment.`
      );
      return;
    }

    setIsPaySaving(true); setPayAmountErr('');
    try {
      // 1. Deduct from balance — create an expense transaction
      const debtCat =
        categories.find(c => /debt|loan|finance|credit/i.test(c.name) && (c.type === 'expense' || c.type === 'both')) ??
        categories.find(c => c.type === 'expense' || c.type === 'both') ??
        categories[0];
      await addTransaction(user.id, {
        type:           'expense',
        amount:         parsed,
        date:           format(new Date(), 'yyyy-MM-dd'),
        category_id:    debtCat?.id ?? null,
        note:           `Debt payment: ${payDebt_.name} → ${payDebt_.lender}`,
        payment_method: 'transfer',
        tags:           ['debt', 'payment'],
        is_recurring:   false,
        group_id:       null,
        user_id:        user.id,
      });

      // 2. Update the debt record
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
          <Text style={[styles.title, { color: C.textPrimary }]}>Finances</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>Budgets, savings & debts.</Text>
        </View>
        {activeTab === 'Budget' && (
          <TouchableOpacity onPress={() => router.push('/modals/add-budget')} style={[styles.addBtn, { borderColor: C.border }]}>
            <View style={styles.addBtnInner}>
              <Plus size={14} color={C.textPrimary} strokeWidth={2.5} />
              <Text style={[styles.addBtnText, { color: C.textPrimary }]}>Budget</Text>
            </View>
          </TouchableOpacity>
        )}
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
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: C.surfaceRaised }]}>
        {(['Budget', 'Goals', 'Debts'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              activeTab === tab && [styles.tabBtnActive, { backgroundColor: C.surface }, Shadow.sm],
            ]}
          >
            {tab === 'Budget' && (
              <BarChart2 size={11} color={activeTab === tab ? C.primary : C.textTertiary} strokeWidth={2} />
            )}
            {tab === 'Debts' && (
              <CreditCard size={11} color={activeTab === tab ? C.danger : C.textTertiary} strokeWidth={2} />
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
        {activeTab === 'Budget' && (
          /* ══════════ BUDGET TAB ══════════ */
          <>
            {/* Personal budgets */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>My Budgets</Text>
              <TouchableOpacity onPress={() => router.push('/modals/add-budget')}>
                <Text style={[styles.sectionSub, { color: C.primary }]}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {budgetsWithSpend.length > 0 ? (
              <View style={[styles.listCard, { backgroundColor: C.surface }, Shadow.sm]}>
                {budgetsWithSpend.map((b, i) => {
                  const pct      = b.amount > 0 ? Math.min((b.spent ?? 0) / b.amount * 100, 100) : 0;
                  const barColor = pct > 90 ? C.danger : pct > 70 ? '#F59E0B' : C.success;
                  const cat      = categories.find((c: any) => c.id === b.category_id);
                  const IconComp = cat ? (CATEGORY_ICON[cat.name?.toLowerCase()] ?? Package) : Package;
                  const catColor = cat?.color ?? C.primary;
                  const remaining = b.amount - (b.spent ?? 0);
                  return (
                    <View
                      key={b.id ?? i}
                      style={[
                        styles.budgetRow,
                        i < budgetsWithSpend.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
                      ]}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: catColor + '20', alignItems: 'center', justifyContent: 'center' }}>
                        <IconComp size={20} color={catColor} strokeWidth={2.25} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{cat?.name ?? 'Budget'}</Text>
                          <Text style={{ ...Typography.bodySmall, color: pct > 90 ? C.danger : C.textSecondary }}>
                            {formatCurrency(b.spent ?? 0, currency, { compact: true })} / {formatCurrency(b.amount, currency, { compact: true })}
                          </Text>
                        </View>
                        <ProgressBar progress={pct} color={barColor} height={6} animated />
                        <Text style={{ ...Typography.caption, color: remaining >= 0 ? C.success : C.danger, marginTop: 3 }}>
                          {remaining >= 0
                            ? `${formatCurrency(remaining, currency, { compact: true })} left`
                            : `${formatCurrency(Math.abs(remaining), currency, { compact: true })} over budget`}
                        </Text>
                      </View>
                      <View style={styles.budgetActions}>
                        <TouchableOpacity
                          onPress={() => router.push(`/modals/add-budget?id=${b.id}` as any)}
                          style={[styles.budgetActionBtn, { backgroundColor: C.primaryLight }]}
                        >
                          <Pencil size={13} color={C.primary} strokeWidth={2.5} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => b.id && removeBudget(b.id)}
                          style={[styles.budgetActionBtn, { backgroundColor: C.dangerLight }]}
                        >
                          <Trash2 size={13} color={C.danger} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/modals/add-budget')}
                style={[styles.emptyGoal, { backgroundColor: C.surface, borderColor: C.border }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.emptyGoalTitle, { color: C.textPrimary }]}>No budgets yet</Text>
                <Text style={[styles.emptyGoalSub, { color: C.textTertiary }]}>Set spending limits by category</Text>
              </TouchableOpacity>
            )}

            {/* Fixed Obligations */}
            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Fixed Obligations</Text>
              <TouchableOpacity onPress={() => router.push('/modals/add-recurring')}>
                <Text style={[styles.sectionSub, { color: C.primary }]}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {recurringItems.length === 0 ? (
              <TouchableOpacity
                onPress={() => router.push('/modals/add-recurring')}
                style={[styles.emptyGoal, { backgroundColor: C.surface, borderColor: C.border }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.emptyGoalTitle, { color: C.textPrimary }]}>No fixed bills yet</Text>
                <Text style={[styles.emptyGoalSub, { color: C.textTertiary }]}>Add rent, subscriptions, debt repayments</Text>
              </TouchableOpacity>
            ) : (
              <>
                <View style={[styles.obligationSummaryCard, { backgroundColor: C.surface }, Shadow.sm]}>
                  <View style={[styles.obligationSummaryLeft, { backgroundColor: C.dangerLight }]}>
                    <Text style={[styles.obligationTotalLabel, { color: C.textTertiary }]}>TOTAL / MONTH</Text>
                    <Text style={[styles.obligationTotalAmt, { color: C.danger }]}>
                      {formatCurrency(recurringItems.reduce((s, r) => s + toMonthly(r.amount, r.frequency), 0), currency)}
                    </Text>
                  </View>
                  <View style={styles.obligationSummaryRight}>
                    <Text style={[styles.obligationCountBig, { color: C.textPrimary }]}>{recurringItems.length}</Text>
                    <Text style={[styles.obligationCountLabel, { color: C.textTertiary }]}>
                      {recurringItems.length === 1 ? 'obligation' : 'obligations'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.listCard, { backgroundColor: C.surface }, Shadow.sm]}>
                  {recurringItems.map((item, i) => {
                    const meta    = BILL_META[item.category] ?? BILL_META.other;
                    const BillIcon = meta.Icon;
                    const monthly = toMonthly(item.amount, item.frequency);
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.obligationRow,
                          i < recurringItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
                        ]}
                      >
                        <View style={[styles.catIconBox, { backgroundColor: meta.color + '20' }]}>
                          <BillIcon size={18} color={meta.color} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>{item.name}</Text>
                          <Text style={{ ...Typography.caption, color: C.textTertiary, marginTop: 2 }}>
                            {item.frequency === 'monthly' ? 'Monthly' : item.frequency === 'weekly' ? 'Weekly' : 'Yearly'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ ...Typography.labelLarge, color: C.textPrimary }}>
                            {formatCurrency(item.amount, currency)}
                          </Text>
                          {item.frequency !== 'monthly' && (
                            <Text style={{ ...Typography.caption, color: C.textTertiary }}>
                              {formatCurrency(monthly, currency)}/mo
                            </Text>
                          )}
                        </View>
                        <View style={styles.obligationActions}>
                          <TouchableOpacity
                            onPress={() => router.push(`/modals/add-recurring?id=${item.id}` as any)}
                            style={[styles.budgetActionBtn, { backgroundColor: C.primaryLight }]}
                          >
                            <Pencil size={13} color={C.primary} strokeWidth={2.5} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => removeRecurring(item.id)}
                            style={[styles.budgetActionBtn, { backgroundColor: C.dangerLight }]}
                          >
                            <Trash2 size={13} color={C.danger} strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}

        {activeTab === 'Goals' && (
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Target size={14} color="#0E2417" strokeWidth={2.5} />
                  <Text style={styles.plannerTitle}>Smart Savings Planner</Text>
                </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Trophy size={16} color={C.textPrimary} strokeWidth={2} />
                  <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Completed</Text>
                </View>
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
                <Star size={44} color={C.textTertiary} strokeWidth={1.5} />
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
        )}

        {activeTab === 'Debts' && (
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
                    {totalDebt > 0 ? formatCurrency(totalDebt, currency) : 'All clear!'}
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
                        <m.Icon size={10} color={m.text} strokeWidth={2.5} />
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Trophy size={16} color={C.textPrimary} strokeWidth={2} />
                  <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Paid off</Text>
                </View>
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
                <CreditCard size={44} color={C.textTertiary} strokeWidth={1.5} />
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

        )}
      </ScrollView>

      {/* Debt payment modal */}
      <Modal visible={!!payDebtId} transparent animationType="slide" onRequestClose={() => setPayDebtId(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPayDebtId(null)} />
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <TouchableOpacity onPress={() => setPayDebtId(null)} style={[styles.modalCloseBtn, { backgroundColor: C.surfaceRaised }]}>
              <X size={16} color={C.textSecondary} strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing[2] }}>
              <Banknote size={18} color={C.textPrimary} strokeWidth={2} />
              <Text style={[styles.modalSub, { color: C.textPrimary }]}>Make Payment</Text>
            </View>
            <Text style={[styles.modalHint, { color: C.textSecondary }]}>
              {payDebt_?.name} → {payDebt_?.lender}
            </Text>

            {/* Balance strip */}
            <View style={[styles.payBalanceRow, {
              backgroundColor: currentBalance > 0 ? C.primaryLight : C.dangerLight,
            }]}>
              <Text style={[styles.payBalanceLabel, { color: C.textSecondary }]}>Available balance</Text>
              <Text style={[styles.payBalanceAmt, {
                color: currentBalance > 0 ? C.primary : C.danger,
              }]}>
                {formatCurrency(Math.max(currentBalance, 0), currency)}
              </Text>
            </View>

            {payAmountErr ? (
              <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
                <Text style={[styles.errorText, { color: C.danger }]}>{payAmountErr}</Text>
                {/* Top-up shortcut when balance is insufficient */}
                {currentBalance < parseCurrencyInput(payAmountStr) && (
                  <TouchableOpacity
                    onPress={() => { setPayDebtId(null); router.push('/modals/add-transaction'); }}
                    style={[styles.topUpBtn, { backgroundColor: C.danger }]}
                  >
                    <Text style={styles.topUpBtnText}>+ Add Income / Top Up</Text>
                  </TouchableOpacity>
                )}
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
            <Text style={[styles.payHint, { color: C.textTertiary }]}>
              {payDebt_ ? formatCurrency(Math.max(payDebt_.totalAmount - payDebt_.amountPaid, 0), currency) : ''} remaining on this debt
            </Text>

            <View style={styles.modalActions}>
              <Button label="Cancel" variant="ghost" onPress={() => setPayDebtId(null)} style={{ flex: 1 }} disabled={isPaySaving} />
              <Button label={isPaySaving ? 'Processing…' : 'Pay Now'} onPress={handlePayDebt} loading={isPaySaving} style={{ flex: 1.5 }} />
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
              <X size={16} color={C.textSecondary} strokeWidth={2.5} />
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
              {modalGoal?.name}
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

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, marginTop: 24, marginBottom: 12,
  },
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
  emptyIcon:    { fontSize: 44 }, // kept for any remaining emoji fallbacks
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
  barLegend: { flexDirection: 'row', gap: Spacing[3] },
  legendItem:{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[1.5] },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3 },

  planSection:       { gap: 12 },
  planSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planSectionTitle:  { ...Typography.titleSmall, fontWeight: '700' },
  planSectionAction: { ...Typography.labelLarge },
  planEmpty: {
    alignItems: 'center', gap: Spacing[2], padding: Spacing[6],
    borderRadius: BorderRadius.xl, borderWidth: 1, borderStyle: 'dashed',
  },
  planEmptyIcon:  { fontSize: 36 }, // kept as fallback
  planEmptyTitle: { ...Typography.titleSmall },
  planEmptyText:  { ...Typography.bodySmall, textAlign: 'center' },

  recurringList: { gap: Spacing[2] },
  recurringCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    borderRadius: BorderRadius.xl, padding: Spacing[3.5],
  },
  recurringIcon:    { width: 40, height: 40, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  recurringEmoji:   { fontSize: 20 }, // kept as fallback
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
  tipIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
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

  // Debt payment modal extras
  payBalanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
  },
  payBalanceLabel: { ...Typography.bodySmall },
  payBalanceAmt:   { ...Typography.titleSmall, fontWeight: '700' },
  payHint:         { ...Typography.caption, textAlign: 'center', marginTop: -Spacing[2] },
  topUpBtn: {
    marginTop: Spacing[2], borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[2.5], alignItems: 'center',
  },
  topUpBtnText: { ...Typography.labelLarge, color: '#fff', fontWeight: '700' },

  // Budget tab
  sectionSub: { fontSize: 15 },
  listCard:   { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
  budgetRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
  },
  budgetActions: {
    flexDirection: 'row', gap: 6, marginLeft: 8,
  },
  budgetActionBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  obligationSummaryCard: {
    marginHorizontal: 16, borderRadius: 16,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 8,
  },
  obligationSummaryLeft: {
    flex: 1, padding: 16,
  },
  obligationSummaryRight: {
    padding: 16, alignItems: 'center', justifyContent: 'center',
  },
  obligationTotalLabel: {
    fontSize: 10, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 4,
  },
  obligationTotalAmt: {
    fontSize: 22, fontWeight: '800',
  },
  obligationCountBig: {
    fontSize: 28, fontWeight: '800',
  },
  obligationCountLabel: {
    fontSize: 12, fontWeight: '500',
  },
  obligationRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
  },
  obligationActions: {
    flexDirection: 'row', gap: 6, marginLeft: 4,
  },
  catIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyGoal: {
    marginHorizontal: 16, borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1, borderStyle: 'dashed',
  },
  emptyGoalTitle: { fontSize: 15, fontWeight: '600' },
  emptyGoalSub:   { fontSize: 13, marginTop: 4 },
});
