import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { format, subDays, addDays, isAfter, startOfDay, startOfMonth, endOfMonth, parseISO } from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useRecurringStore }   from '../../src/stores/recurringStore';
import { TransactionType, Category } from '../../src/types';
import { formatCurrency } from '../../src/utils/currency';
import { Button }   from '../../src/components/ui/Button';
import { Input }    from '../../src/components/ui/Input';
import { useTheme } from '../../src/theme/ThemeContext';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { parseCurrencyInput } from '../../src/utils/currency';
import { getExpenseCategories, getIncomeCategories, PAYMENT_METHODS } from '../../src/utils/categories';
import { hapticSelect, hapticSuccess } from '../../src/utils/haptics';

const today = startOfDay(new Date());

function isFutureDay(d: Date) {
  return isAfter(startOfDay(d), today);
}

function friendlyDate(d: Date): string {
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
  if (diff === 0)  return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === -2) return '2 days ago';
  return format(d, 'MMM d, yyyy');
}

export default function AddTransactionModal() {
  const C = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, profile }                                                           = useAuthStore();
  const { categories, transactions, addTransaction, editTransaction, removeTransaction, syncFromServer, isSyncing } = useTransactionStore();

  const existing  = id ? transactions.find(t => t.id === id) : null;
  const isEditing = !!existing;

  const [type,          setType]          = useState<TransactionType>(existing?.type ?? 'expense');
  const [amountStr,     setAmountStr]     = useState(existing ? String(existing.amount) : '');
  const [categoryId,    setCategoryId]    = useState<string>(existing?.category_id ?? '');
  const [note,          setNote]          = useState(existing?.note ?? '');
  const [date,          setDate]          = useState<Date>(existing ? startOfDay(new Date(existing.date)) : today);
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(existing?.payment_method ?? null);
  const [isSaving,       setIsSaving]       = useState(false);
  const [isDeleting,     setIsDeleting]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState(false);
  const [showDeductStep, setShowDeductStep] = useState(false);
  const [showOverdraftSheet, setShowOverdraftSheet] = useState(false);

  const { items: recurringItems, load: loadRecurring, toggleDeduct } = useRecurringStore();

  useEffect(() => { loadRecurring(); }, []);

  const slideAnim = useRef(new Animated.Value(existing?.type === 'income' ? 1 : 0)).current;

  useEffect(() => {
    if (user && categories.length === 0) syncFromServer(user.id);
  }, [user?.id]);

  const switchType = (t: TransactionType) => {
    hapticSelect();
    setType(t);
    if (!isEditing) setCategoryId('');
    Animated.spring(slideAnim, { toValue: t === 'expense' ? 0 : 1, useNativeDriver: false, tension: 80, friction: 12 }).start();
  };

  const availableCategories = type === 'expense'
    ? getExpenseCategories(categories)
    : getIncomeCategories(categories);

  useEffect(() => {
    if (availableCategories.length > 0 && !categoryId) {
      setCategoryId(availableCategories[0].id);
    }
  }, [type, availableCategories.length]);

  // ── Live overdraft indicator ─────────────────────────────────────────────
  const typedAmount = parseCurrencyInput(amountStr);

  // Identical formula to the dashboard:
  //   available = thisMonthIncome − thisMonthExpenses − recurringBillsTotal
  // So when the dashboard shows 0, this also sees 0 and warns on any expense.
  const { monthlyIncome, monthlySpent } = React.useMemo(() => {
    const monthStart = startOfMonth(date);
    const monthEnd   = endOfMonth(date);
    let income = 0, spent = 0;
    for (const t of transactions) {
      const d = parseISO(t.date);
      if (d < monthStart || d > monthEnd) continue;
      if (t.type === 'income')  income += t.amount;
      if (t.type === 'expense') spent  += t.amount;
    }
    return { monthlyIncome: income, monthlySpent: spent };
  }, [date, transactions]);

  // Same billsTotal the dashboard uses (recurring obligations, converted to monthly)
  const billsTotal = React.useMemo(() =>
    recurringItems.reduce((s, i) => {
      if (i.frequency === 'weekly') return s + i.amount * 52 / 12;
      if (i.frequency === 'yearly') return s + i.amount / 12;
      return s + i.amount;
    }, 0),
  [recurringItems]);

  // available = what the dashboard shows as free money. If 0, warn on ANY expense.
  const available      = Math.max(monthlyIncome - monthlySpent - billsTotal, 0);
  const wouldOverdraft = !isEditing && type === 'expense' && typedAmount > 0 && typedAmount > available;
  const overdraftBy    = wouldOverdraft ? typedAmount - available : 0;

  // ── Core save (used by both normal path and overdraft confirmation) ─────────
  const doSave = async (incomeSource?: { label: string; tags: string[] }) => {
    if (!user) return;
    setIsSaving(true);
    setError('');
    const amount  = parseCurrencyInput(amountStr);
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      // Optionally log where the money came from
      if (incomeSource) {
        const incomeCat = categories.find(c => c.type === 'income' || c.type === 'both') ?? categories[0];
        await addTransaction(user.id, {
          type: 'income', amount, date: dateStr,
          category_id: incomeCat?.id ?? null,
          note: incomeSource.label,
          payment_method: null,
          tags: incomeSource.tags,
          is_recurring: false, group_id: null, user_id: user.id,
        });
      }
      // Save the actual transaction
      if (isEditing && existing) {
        await editTransaction(existing.id, {
          type, amount, date: dateStr,
          category_id: categoryId,
          note: note.trim() || null,
          payment_method: (paymentMethod as any) ?? null,
        });
      } else {
        await addTransaction(user.id, {
          type, amount, date: dateStr,
          category_id: categoryId,
          note: note.trim() || null,
          payment_method: (paymentMethod as any) ?? null,
          tags: [], is_recurring: false, group_id: null, user_id: user.id,
        });
      }
      hapticSuccess();
      setSuccess(true);
      setShowOverdraftSheet(false);
      if (!isEditing && type === 'income' && recurringItems.length > 0) {
        setTimeout(() => setShowDeductStep(true), 400);
      } else {
        setTimeout(() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)');
        }, 600);
      }
    } catch (err: any) {
      setError(err.message ?? 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (typedAmount <= 0) { setError('Please enter an amount greater than 0.'); return; }
    if (!categoryId)      { setError('Please select a category.'); return; }
    if (!user)            { setError('You must be logged in.'); return; }

    if (wouldOverdraft) {
      setShowOverdraftSheet(true); // open the sheet — don't save yet
      return;
    }
    await doSave();
  };

  const handleDelete = async () => {
    if (!existing) return;
    setIsDeleting(true);
    setError('');
    try {
      await removeTransaction(existing.id);
      hapticSuccess();
      setShowDeleteConfirm(false);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message ?? 'Could not delete. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const currency       = profile?.currency ?? 'MYR';
  const currencySymbol = currency === 'MYR' ? 'RM' : currency;

  const dismissDeductStep = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  if (showDeductStep) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <View style={{ width: 36 }} />
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Deduct Fixed Expenses?</Text>
          <TouchableOpacity
            onPress={dismissDeductStep}
            style={[styles.closeBtn, { backgroundColor: C.surfaceRaised }]}
          >
            <Text style={[styles.closeBtnText, { color: C.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.deductContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.deductSubtitle, { color: C.textSecondary }]}>
            Select which fixed expenses to subtract from this income on the home screen.
            This helps you see your real available balance.
          </Text>
          {recurringItems.map(item => {
            const checked = item.deductFromIncome;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => { hapticSelect(); toggleDeduct(item.id); }}
                style={[styles.deductRow, { backgroundColor: C.surfaceRaised }, checked && { backgroundColor: C.primaryLight }]}
                activeOpacity={0.7}
              >
                <View style={styles.deductRowLeft}>
                  <View style={[styles.checkbox, { borderColor: checked ? C.primary : C.border }, checked && { backgroundColor: C.primary }]}>
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.deductInfo}>
                    <Text style={[styles.deductName, { color: C.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.deductFreq, { color: C.textTertiary }]}>
                      {formatCurrency(item.amount, currency)} / {item.frequency}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.deductAmount, { color: checked ? C.primary : C.textSecondary }]}>
                  {checked ? '- ' : ''}{formatCurrency(item.amount, currency)}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={[styles.deductSummary, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.deductSummaryLabel, { color: C.textSecondary }]}>Total deductions</Text>
            <Text style={[styles.deductSummaryValue, { color: C.danger }]}>
              - {formatCurrency(recurringItems.filter(i => i.deductFromIncome).reduce((s, i) => s + i.amount, 0), currency)}
            </Text>
          </View>
          <Button
            label="Done — Show on home screen"
            onPress={dismissDeductStep}
            fullWidth size="lg"
            style={{ marginTop: Spacing[2] }}
          />
          <View style={{ height: Spacing[6] }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
            style={[styles.closeBtn, { backgroundColor: C.surfaceRaised }]}
          >
            <Text style={[styles.closeBtnText, { color: C.textSecondary }]}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
            {isEditing ? 'Edit Transaction' : 'Add Transaction'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {success && (
            <View style={[styles.successBox, { backgroundColor: C.successLight }]}>
              <Text style={[styles.successText, { color: C.success }]}>✓  {isEditing ? 'Updated!' : 'Saved!'}</Text>
            </View>
          )}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
              <Text style={[styles.errorText, { color: C.danger }]}>⚠️  {error}</Text>
            </View>
          ) : null}

          {/* Type toggle */}
          <View style={[styles.typeToggleTrack, { backgroundColor: C.surfaceRaised }]}>
            <Animated.View
              style={[
                styles.typeToggleThumb,
                { backgroundColor: C.surface },
                { left: slideAnim.interpolate({ inputRange: [0, 1], outputRange: ['2%', '52%'] }) },
              ]}
            />
            <TouchableOpacity onPress={() => switchType('expense')} style={styles.typeToggleBtn}>
              <Text style={[styles.typeToggleText, { color: type === 'expense' ? C.textPrimary : C.textTertiary }]}>
                ↓ Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => switchType('income')} style={styles.typeToggleBtn}>
              <Text style={[styles.typeToggleText, { color: type === 'income' ? C.textPrimary : C.textTertiary }]}>
                ↑ Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <View style={styles.amountBlock}>
            <Text style={[styles.currencySymbol, { color: C.textSecondary }]}>{currencySymbol}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={C.textTertiary}
              style={[styles.amountInput, { color: wouldOverdraft ? '#EF4444' : C.textPrimary }]}
              autoFocus={!isEditing}
              maxLength={12}
            />
          </View>

          {/* Live overdraft warning banner */}
          {wouldOverdraft && (
            <TouchableOpacity
              onPress={() => setShowOverdraftSheet(true)}
              style={styles.overdraftBanner}
              activeOpacity={0.8}
            >
              <Text style={styles.overdraftBannerIcon}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.overdraftBannerTitle}>Over your balance by {formatCurrency(overdraftBy, currency)}</Text>
                <Text style={styles.overdraftBannerSub}>Tap to tell us where this money is coming from</Text>
              </View>
              <Text style={styles.overdraftBannerArrow}>›</Text>
            </TouchableOpacity>
          )}

          {/* ── Date Picker ─────────────────────────────── */}
          <View style={[styles.dateSection, { backgroundColor: C.surfaceRaised, borderRadius: BorderRadius.xl }]}>
            <Text style={[styles.dateSectionLabel, { color: C.textSecondary }]}>📅  Date</Text>

            {/* Arrow nav */}
            <View style={styles.dateNav}>
              <TouchableOpacity
                onPress={() => setDate(d => subDays(d, 1))}
                style={[styles.dateArrow, { backgroundColor: C.surface }]}
              >
                <Text style={[styles.dateArrowText, { color: C.textPrimary }]}>‹</Text>
              </TouchableOpacity>

              <Text style={[styles.dateLabel, { color: C.textPrimary }]}>{friendlyDate(date)}</Text>

              <TouchableOpacity
                onPress={() => setDate(d => addDays(d, 1))}
                disabled={isFutureDay(addDays(date, 1))}
                style={[
                  styles.dateArrow,
                  { backgroundColor: C.surface },
                  isFutureDay(addDays(date, 1)) && { opacity: 0.3 },
                ]}
              >
                <Text style={[styles.dateArrowText, { color: C.textPrimary }]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Quick presets */}
            <View style={styles.datePresets}>
              {[
                { label: 'Today',     days: 0 },
                { label: 'Yesterday', days: -1 },
                { label: '2 days ago', days: -2 },
                { label: '1 week ago', days: -7 },
              ].map(({ label, days }) => {
                const preset = startOfDay(addDays(today, days));
                const isSelected = date.getTime() === preset.getTime();
                return (
                  <TouchableOpacity
                    key={label}
                    onPress={() => setDate(preset)}
                    style={[
                      styles.datePreset,
                      { backgroundColor: C.surface },
                      isSelected && { backgroundColor: C.primary },
                    ]}
                  >
                    <Text style={[styles.datePresetText, { color: isSelected ? '#fff' : C.textSecondary }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Full date display */}
            <Text style={[styles.dateFullText, { color: C.textTertiary }]}>
              {format(date, 'EEEE, MMMM d yyyy')}
            </Text>
          </View>

          {/* Categories */}
          <View>
            <Text style={[styles.sectionLabel, { color: C.textPrimary }]}>Category</Text>
            {isSyncing && categories.length === 0 ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={C.primary} />
                <Text style={[styles.loadingText, { color: C.textSecondary }]}>Loading categories…</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {availableCategories.map(cat => (
                  <CategoryChip
                    key={cat.id}
                    category={cat}
                    selected={categoryId === cat.id}
                    onPress={() => { hapticSelect(); setCategoryId(cat.id); }}
                    C={C}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="What was this for?" maxLength={200} />

          <TouchableOpacity onPress={() => setShowAdvanced(v => !v)} style={styles.advancedToggle}>
            <Text style={[styles.advancedToggleText, { color: C.primary }]}>
              {showAdvanced ? '▲ Hide options' : '▼ More options'}
            </Text>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.advanced}>
              <Text style={[styles.sectionLabel, { color: C.textPrimary }]}>Payment Method</Text>
              <View style={styles.paymentRow}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity
                    key={m.value}
                    onPress={() => setPaymentMethod(prev => prev === m.value ? null : m.value)}
                    style={[
                      styles.paymentChip,
                      { backgroundColor: C.surfaceRaised, borderColor: 'transparent' },
                      paymentMethod === m.value && { backgroundColor: C.primaryLight, borderColor: C.primary },
                    ]}
                  >
                    <Text style={styles.paymentIcon}>{m.icon}</Text>
                    <Text style={[styles.paymentLabel, { color: paymentMethod === m.value ? C.primary : C.textSecondary }]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Button
            label={isSaving ? 'Saving…' : (isEditing ? 'Save Changes' : `Save ${type === 'expense' ? 'Expense' : 'Income'}`)}
            onPress={handleSave}
            loading={isSaving}
            fullWidth
            size="lg"
            style={styles.saveBtn}
          />

          {/* Delete button — edit mode only */}
          {isEditing && (
            <TouchableOpacity
              onPress={() => setShowDeleteConfirm(true)}
              style={[styles.deleteBtn, { borderColor: C.danger + '40' }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.deleteBtnText, { color: C.danger }]}>Delete transaction</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: Spacing[6] }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Delete confirmation sheet ─────────────────────────────────────── */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowDeleteConfirm(false)}
          />
          <View style={[styles.sheetPanel, { backgroundColor: C.isDark ? '#2D3B50' : '#FFFFFF' }]}>
            <View style={styles.sheetHandle} />
            <View style={{ padding: Spacing[5], gap: Spacing[4] }}>
              {/* Warning header */}
              <View style={[styles.deleteConfirmHeader, { backgroundColor: C.dangerLight }]}>
                <Text style={{ fontSize: 28 }}>🗑️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.deleteConfirmTitle, { color: C.danger }]}>Delete this transaction?</Text>
                  <Text style={[styles.deleteConfirmSub, { color: C.textSecondary }]}>
                    {existing?.note
                      ? `"${existing.note}" · ${formatCurrency(existing?.amount ?? 0, currency)}`
                      : `${formatCurrency(existing?.amount ?? 0, currency)} ${type} · this cannot be undone`}
                  </Text>
                </View>
              </View>

              {/* Action buttons */}
              <TouchableOpacity
                onPress={handleDelete}
                disabled={isDeleting}
                style={[styles.deleteConfirmBtn, { backgroundColor: C.danger }]}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteConfirmBtnText}>
                  {isDeleting ? 'Deleting…' : 'Yes, delete it'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(false)}
                style={[styles.deleteCancelBtn, { backgroundColor: C.surfaceRaised }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.deleteCancelBtnText, { color: C.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Overdraft source sheet ─────────────────────────────────────────── */}
      <Modal
        visible={showOverdraftSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOverdraftSheet(false)}
      >
        <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowOverdraftSheet(false)}
          />
          <View style={[styles.sheetPanel, { backgroundColor: C.isDark ? '#2D3B50' : '#FFFFFF' }]}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Warning header */}
            <View style={[styles.sheetWarningHeader, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.sheetWarningIcon}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetWarningTitle, { color: '#92400E' }]}>
                  This is {formatCurrency(overdraftBy, currency)} over your balance
                </Text>
                <Text style={[styles.sheetWarningBody, { color: '#B45309' }]}>
                  You have {formatCurrency(available, currency)} left this month.
                  Where did this money come from?
                </Text>
              </View>
            </View>

            {/* Source options */}
            {([
              { icon: '💸', title: 'I borrowed it',               subtitle: 'From a friend, family or someone else',  label: 'Borrowed money',                    tags: ['borrowed', 'debt'] },
              { icon: '💳', title: 'Credit / Buy now pay later',  subtitle: 'Card debt, BNPL or instalment plan',     label: 'Credit / BNPL spend',               tags: ['credit', 'debt']  },
              { icon: '🏦', title: 'From another account',        subtitle: 'Savings account, e-wallet or other bank',label: 'Transfer in from another account',  tags: ['transfer']         },
              { icon: '🎁', title: 'Gift or money received',      subtitle: 'Cash gift or someone paid on your behalf',label: 'Gift / money received',             tags: ['gift']             },
            ] as const).map(src => (
              <TouchableOpacity
                key={src.title}
                disabled={isSaving}
                onPress={() => { hapticSelect(); doSave({ label: src.label, tags: [...src.tags] }); }}
                style={[styles.sheetOption, { borderBottomColor: C.divider }]}
                activeOpacity={0.7}
              >
                <Text style={styles.sheetOptionIcon}>{src.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetOptionTitle, { color: C.textPrimary }]}>{src.title}</Text>
                  <Text style={[styles.sheetOptionSub,   { color: C.textTertiary }]}>{src.subtitle}</Text>
                </View>
                <Text style={[styles.sheetOptionChevron, { color: C.textTertiary }]}>›</Text>
              </TouchableOpacity>
            ))}

            {/* Just save it */}
            <TouchableOpacity
              disabled={isSaving}
              onPress={() => doSave()}
              style={styles.sheetSkip}
              activeOpacity={0.7}
            >
              {isSaving
                ? <ActivityIndicator color={C.textTertiary} />
                : <Text style={[styles.sheetSkipText, { color: C.textTertiary }]}>
                    Just record the expense — I'll sort it later
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function CategoryChip({ category, selected, onPress, C }: { category: Category; selected: boolean; onPress: () => void; C: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.catChip,
        { backgroundColor: C.surfaceRaised },
        selected && { backgroundColor: category.color, ...Shadow.sm },
      ]}
    >
      <View style={[styles.catChipIcon, !selected && { backgroundColor: category.color + '20' }]}>
        <Text style={styles.catChipEmoji}>{category.icon}</Text>
      </View>
      <Text style={[styles.catChipLabel, { color: selected ? '#fff' : C.textPrimary }]}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4], borderBottomWidth: 1,
  },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16 },
  headerTitle:  { ...Typography.titleMedium },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], gap: Spacing[5] },

  successBox: { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  successText:{ ...Typography.bodySmall },
  errorBox:   { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText:  { ...Typography.bodySmall },

  typeToggleTrack: {
    flexDirection: 'row', borderRadius: BorderRadius.xl, height: 46,
    position: 'relative', overflow: 'hidden',
  },
  typeToggleThumb: {
    position: 'absolute', top: '8%', width: '46%', height: '84%',
    borderRadius: BorderRadius.lg, ...Shadow.sm,
  },
  typeToggleBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  typeToggleText: { ...Typography.labelLarge },

  amountBlock: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', paddingVertical: Spacing[2], gap: Spacing[2],
  },
  currencySymbol: { fontSize: 28, fontWeight: '600', marginBottom: 6 },
  amountInput: {
    fontSize: 56, fontWeight: '700', letterSpacing: -2, minWidth: 120, textAlign: 'center',
  },

  // Date picker
  dateSection: { padding: Spacing[4], gap: Spacing[3] },
  dateSectionLabel: { ...Typography.labelLarge },
  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateArrow: {
    width: 40, height: 40, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  dateArrowText: { fontSize: 24, fontWeight: '300' },
  dateLabel:    { ...Typography.titleMedium, flex: 1, textAlign: 'center' },
  datePresets:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  datePreset: {
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full,
  },
  datePresetText: { ...Typography.labelSmall },
  dateFullText:   { ...Typography.caption, textAlign: 'center' },

  sectionLabel:  { ...Typography.labelLarge, marginBottom: Spacing[2.5] },
  loadingRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3] },
  loadingText:   { ...Typography.bodySmall },

  categoryRow: { gap: Spacing[2], paddingRight: Spacing[2] },
  catChip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.xl, paddingVertical: Spacing[2], paddingHorizontal: Spacing[3], gap: Spacing[2],
  },
  catChipIcon:  { width: 32, height: 32, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  catChipEmoji: { fontSize: 18 },
  catChipLabel: { ...Typography.labelLarge },

  advancedToggle:     { alignItems: 'center', paddingVertical: Spacing[1] },
  advancedToggleText: { ...Typography.bodySmall },

  advanced:   { gap: Spacing[3] },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  paymentChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[1.5],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full, borderWidth: 1.5,
  },
  paymentIcon:  { fontSize: 16 },
  paymentLabel: { ...Typography.labelSmall },

  saveBtn: { marginTop: Spacing[2] },

  // Delete button (edit mode)
  deleteBtn: {
    marginTop: Spacing[1], paddingVertical: Spacing[3.5],
    borderRadius: BorderRadius.full, alignItems: 'center',
    borderWidth: 1.5,
  },
  deleteBtnText: { ...Typography.labelLarge, fontWeight: '700' },

  // Delete confirm sheet
  deleteConfirmHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  deleteConfirmTitle: { ...Typography.labelLarge, fontWeight: '700' },
  deleteConfirmSub:   { ...Typography.bodySmall, marginTop: 3, lineHeight: 18 },
  deleteConfirmBtn: {
    borderRadius: BorderRadius.full, paddingVertical: Spacing[4],
    alignItems: 'center',
  },
  deleteConfirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  deleteCancelBtn: {
    borderRadius: BorderRadius.full, paddingVertical: Spacing[4],
    alignItems: 'center',
  },
  deleteCancelBtnText: { fontWeight: '600', fontSize: 15 },

  // Live overdraft banner (inline in form)
  overdraftBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    backgroundColor: '#FEF3C7', borderRadius: BorderRadius.xl,
    padding: Spacing[3.5],
  },
  overdraftBannerIcon:  { fontSize: 20 },
  overdraftBannerTitle: { ...Typography.labelLarge, color: '#92400E' },
  overdraftBannerSub:   { ...Typography.caption, color: '#B45309', marginTop: 2 },
  overdraftBannerArrow: { fontSize: 20, color: '#92400E', fontWeight: '300' },

  // Overdraft bottom sheet Modal
  sheetOverlay:  { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetPanel: {
    borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'],
    paddingTop: Spacing[2], paddingBottom: Spacing[8], overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 24,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#94A3B8',
    alignSelf: 'center', marginBottom: Spacing[3], opacity: 0.5,
  },
  sheetWarningHeader: {
    flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start',
    margin: Spacing[4], borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  sheetWarningIcon:  { fontSize: 22 },
  sheetWarningTitle: { ...Typography.labelLarge },
  sheetWarningBody:  { ...Typography.bodySmall, lineHeight: 20, marginTop: 3 },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[3.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetOptionIcon:    { fontSize: 24 },
  sheetOptionTitle:   { ...Typography.labelLarge },
  sheetOptionSub:     { ...Typography.caption, marginTop: 2 },
  sheetOptionChevron: { fontSize: 22, fontWeight: '300' },
  sheetSkip: {
    marginHorizontal: Spacing[5], marginTop: Spacing[3],
    paddingVertical: Spacing[3.5], alignItems: 'center',
  },
  sheetSkipText: { ...Typography.bodySmall, textAlign: 'center' },

  deductContent:      { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], gap: Spacing[3], paddingBottom: Spacing[10] },
  deductSubtitle:     { ...Typography.bodyMedium, lineHeight: 22 },
  deductRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  deductRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], flex: 1 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  checkmark:    { color: '#fff', fontSize: 14, fontWeight: '700' },
  deductInfo:   { flex: 1, gap: 2 },
  deductName:   { ...Typography.labelLarge },
  deductFreq:   { ...Typography.caption },
  deductAmount: { ...Typography.labelLarge },
  deductSummary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: BorderRadius.xl, padding: Spacing[4], borderWidth: 1,
  },
  deductSummaryLabel: { ...Typography.bodyMedium },
  deductSummaryValue: { ...Typography.titleSmall },
});
