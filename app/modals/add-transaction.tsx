import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { TransactionType, Category } from '../../src/types';
import { Button }   from '../../src/components/ui/Button';
import { Input }    from '../../src/components/ui/Input';
import { Colors }   from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { parseCurrencyInput, formatCurrency } from '../../src/utils/currency';
import { getExpenseCategories, getIncomeCategories, PAYMENT_METHODS } from '../../src/utils/categories';

export default function AddTransactionModal() {
  const { user, profile }                        = useAuthStore();
  const { categories, addTransaction, isSyncing } = useTransactionStore();

  // ── Form state ───────────────────────────────────────────────────────────
  const [type,          setType]          = useState<TransactionType>('expense');
  const [amountStr,     setAmountStr]     = useState('');
  const [categoryId,    setCategoryId]    = useState<string>('');
  const [note,          setNote]          = useState('');
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [isSaving,      setIsSaving]      = useState(false);

  // ── Animation for type toggle ─────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchType = (t: TransactionType) => {
    Haptics.selectionAsync();
    setType(t);
    Animated.spring(slideAnim, {
      toValue:         t === 'expense' ? 0 : 1,
      useNativeDriver: false,
      tension:         80,
      friction:        12,
    }).start();
    setCategoryId('');
  };

  // ── Category list ─────────────────────────────────────────────────────
  const availableCategories = type === 'expense'
    ? getExpenseCategories(categories)
    : getIncomeCategories(categories);

  // Auto-select first category when type changes
  useEffect(() => {
    if (availableCategories.length > 0 && !categoryId) {
      setCategoryId(availableCategories[0].id);
    }
  }, [type, availableCategories.length]);

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const amount = parseCurrencyInput(amountStr);
    if (amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Select a category', 'Please choose a category for this transaction.');
      return;
    }
    if (!user) return;

    setIsSaving(true);
    try {
      await addTransaction(user.id, {
        type,
        amount,
        category_id:    categoryId,
        note:           note.trim() || null,
        date:           format(new Date(), 'yyyy-MM-dd'),
        payment_method: (paymentMethod as any) ?? null,
        tags:           [],
        is_recurring:   false,
        group_id:       null,
        user_id:        user.id,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save transaction. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const currency = profile?.currency ?? 'MYR';
  const currencySymbol = currency === 'MYR' ? 'RM' : currency;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Transaction</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Type Toggle ───────────────────────────────── */}
          <View style={styles.typeToggleTrack}>
            <Animated.View
              style={[
                styles.typeToggleThumb,
                {
                  left: slideAnim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: ['2%', '52%'],
                  }),
                },
              ]}
            />
            <TouchableOpacity
              onPress={() => switchType('expense')}
              style={styles.typeToggleBtn}
            >
              <Text style={[styles.typeToggleText, type === 'expense' && styles.typeToggleTextActive]}>
                ↓ Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => switchType('income')}
              style={styles.typeToggleBtn}
            >
              <Text style={[styles.typeToggleText, type === 'income' && styles.typeToggleTextActive]}>
                ↑ Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Amount Input ──────────────────────────────── */}
          <View style={styles.amountBlock}>
            <Text style={styles.currencySymbol}>{currencySymbol}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              style={styles.amountInput}
              autoFocus
              maxLength={12}
            />
          </View>

          {/* ── Category Grid ─────────────────────────────── */}
          <View>
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {availableCategories.map(cat => (
                <CategoryChip
                  key={cat.id}
                  category={cat}
                  selected={categoryId === cat.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCategoryId(cat.id);
                  }}
                />
              ))}
            </ScrollView>
          </View>

          {/* ── Note ─────────────────────────────────────── */}
          <Input
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="What was this for?"
            maxLength={200}
          />

          {/* ── Advanced toggle ───────────────────────────── */}
          <TouchableOpacity
            onPress={() => setShowAdvanced(v => !v)}
            style={styles.advancedToggle}
          >
            <Text style={styles.advancedToggleText}>
              {showAdvanced ? '▲ Hide advanced' : '▼ Show more options'}
            </Text>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.advanced}>
              <Text style={styles.sectionLabel}>Payment Method</Text>
              <View style={styles.paymentRow}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity
                    key={m.value}
                    onPress={() => setPaymentMethod(prev => prev === m.value ? null : m.value)}
                    style={[
                      styles.paymentChip,
                      paymentMethod === m.value && styles.paymentChipActive,
                    ]}
                  >
                    <Text style={styles.paymentIcon}>{m.icon}</Text>
                    <Text style={[
                      styles.paymentLabel,
                      paymentMethod === m.value && styles.paymentLabelActive,
                    ]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Save button ───────────────────────────────── */}
          <Button
            label={isSaving ? 'Saving…' : `Save ${type === 'expense' ? 'Expense' : 'Income'}`}
            onPress={handleSave}
            loading={isSaving}
            fullWidth
            size="lg"
            style={styles.saveBtn}
          />

          <View style={{ height: Spacing[6] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Category chip ────────────────────────────────────────────────────────────

function CategoryChip({
  category,
  selected,
  onPress,
}: {
  category: Category;
  selected: boolean;
  onPress:  () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.catChip,
        selected && { backgroundColor: category.color, ...Shadow.sm },
      ]}
    >
      <View style={[styles.catChipIcon, !selected && { backgroundColor: category.color + '20' }]}>
        <Text style={styles.catChipEmoji}>{category.icon}</Text>
      </View>
      <Text style={[styles.catChipLabel, selected && { color: Colors.white }]}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: Colors.white,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing[5],
    paddingVertical:   Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: Colors.surfaceRaised,
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnText: {
    fontSize: 16,
    color:    Colors.textSecondary,
  },
  headerTitle: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },

  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing[5],
    paddingTop:        Spacing[5],
    gap:               Spacing[5],
  },

  // Type toggle
  typeToggleTrack: {
    flexDirection:   'row',
    backgroundColor: Colors.surfaceRaised,
    borderRadius:    BorderRadius.xl,
    height:          46,
    position:        'relative',
    overflow:        'hidden',
  },
  typeToggleThumb: {
    position:        'absolute',
    top:             '8%',
    width:           '46%',
    height:          '84%',
    backgroundColor: Colors.white,
    borderRadius:    BorderRadius.lg,
    ...Shadow.sm,
  },
  typeToggleBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         1,
  },
  typeToggleText: {
    ...Typography.labelLarge,
    color: Colors.textTertiary,
  },
  typeToggleTextActive: {
    color: Colors.textPrimary,
  },

  // Amount
  amountBlock: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'center',
    paddingVertical: Spacing[3],
    gap:            Spacing[2],
  },
  currencySymbol: {
    fontSize:    28,
    fontWeight:  '600',
    color:       Colors.textSecondary,
    marginBottom: 6,
  },
  amountInput: {
    fontSize:    56,
    fontWeight:  '700',
    color:       Colors.textPrimary,
    letterSpacing: -2,
    minWidth:    120,
    textAlign:   'center',
  },

  sectionLabel: {
    ...Typography.labelLarge,
    color:         Colors.textPrimary,
    marginBottom:  Spacing[2.5],
  },

  // Category chips (horizontal scroll)
  categoryRow: {
    gap:            Spacing[2],
    paddingRight:   Spacing[2],
  },
  catChip: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius:    BorderRadius.xl,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    gap:             Spacing[2],
  },
  catChipIcon: {
    width:          32,
    height:         32,
    borderRadius:   BorderRadius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  catChipEmoji: {
    fontSize: 18,
  },
  catChipLabel: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
  },

  // Advanced
  advancedToggle: {
    alignItems: 'center',
    paddingVertical: Spacing[1],
  },
  advancedToggleText: {
    ...Typography.bodySmall,
    color: Colors.primary,
  },
  advanced: {
    gap: Spacing[3],
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing[2],
  },
  paymentChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing[1.5],
    paddingHorizontal: Spacing[3],
    paddingVertical:   Spacing[2],
    borderRadius:      BorderRadius.full,
    backgroundColor:   Colors.surfaceRaised,
    borderWidth:       1.5,
    borderColor:       'transparent',
  },
  paymentChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor:     Colors.primary,
  },
  paymentIcon:  { fontSize: 16 },
  paymentLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  paymentLabelActive: {
    color: Colors.primary,
  },

  saveBtn: {
    marginTop: Spacing[2],
  },
});
