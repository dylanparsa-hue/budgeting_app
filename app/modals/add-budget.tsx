import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { hapticSelect, hapticSuccess } from '../../src/utils/haptics';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useBudgetStore }      from '../../src/stores/budgetStore';
import { Button }   from '../../src/components/ui/Button';
import { useTheme } from '../../src/theme/ThemeContext';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';
import { getExpenseCategories }  from '../../src/utils/categories';
import { parseCurrencyInput }    from '../../src/utils/currency';

const now   = new Date();
const MONTH = now.getMonth() + 1;
const YEAR  = now.getFullYear();

export default function AddBudgetModal() {
  const C = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, profile }                 = useAuthStore();
  const { categories }                    = useTransactionStore();
  const { budgets, saveBudget }           = useBudgetStore();

  const existing  = id ? budgets.find(b => b.id === id) : null;
  const isEditing = !!existing;

  const [categoryId, setCategoryId]       = useState(existing?.category_id ?? '');
  const [amountStr,  setAmountStr]        = useState(existing ? String(existing.amount) : '');
  const [isSaving,   setIsSaving]         = useState(false);
  const [error,      setError]            = useState('');

  const expenseCategories = getExpenseCategories(categories);
  const currency          = profile?.currency ?? 'MYR';
  const symbol            = currency === 'MYR' ? 'RM' : currency;

  useEffect(() => {
    if (expenseCategories.length > 0 && !categoryId) {
      setCategoryId(expenseCategories[0].id);
    }
  }, [expenseCategories.length]);

  const handleSave = async () => {
    setError('');
    const amount = parseCurrencyInput(amountStr);
    if (amount <= 0) { setError('Please enter a budget amount.'); return; }
    if (!categoryId) { setError('Please select a category.'); return; }
    if (!user) return;

    setIsSaving(true);
    try {
      await saveBudget({
        ...(isEditing && existing ? { id: existing.id } as any : {}),
        user_id: user.id, group_id: null, category_id: categoryId,
        amount, period: 'monthly', month: MONTH, year: YEAR,
      });
      hapticSuccess();
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/budgets');
    } catch (err: any) {
      setError(err.message ?? 'Could not save budget. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/budgets')}
            style={[styles.closeBtn, { backgroundColor: C.surfaceRaised }]}
          >
            <Text style={[styles.closeBtnText, { color: C.textSecondary }]}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
            {isEditing ? 'Edit Budget' : 'Set Budget'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            {isEditing ? 'Update your monthly spending limit' : 'Set a monthly spending limit for a category'}
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
              <Text style={[styles.errorText, { color: C.danger }]}>⚠️  {error}</Text>
            </View>
          ) : null}

          {/* Amount */}
          <View style={styles.amountBlock}>
            <Text style={[styles.symbol, { color: C.textSecondary }]}>{symbol}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={C.textTertiary}
              style={[styles.amountInput, { color: C.textPrimary }]}
              autoFocus={!isEditing}
              maxLength={10}
            />
          </View>

          {/* Category grid */}
          <Text style={[styles.label, { color: C.textPrimary }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {expenseCategories.map(cat => {
              const selected = categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => { hapticSelect(); setCategoryId(cat.id); }}
                  style={[
                    styles.catItem,
                    { backgroundColor: C.surfaceRaised },
                    selected && { backgroundColor: cat.color },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.catEmoji}>{cat.icon}</Text>
                  <Text style={[styles.catName, { color: selected ? '#fff' : C.textPrimary }]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            label={isSaving ? 'Saving…' : (isEditing ? 'Save Changes' : 'Set Budget')}
            onPress={handleSave}
            loading={isSaving}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing[4] }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4], borderBottomWidth: 1,
  },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:{ fontSize: 16 },
  headerTitle: { ...Typography.titleMedium },

  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], gap: Spacing[5], paddingBottom: Spacing[10] },
  subtitle:{ ...Typography.bodyMedium, textAlign: 'center' },
  errorBox:{ borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText:{ ...Typography.bodySmall },

  amountBlock: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', paddingVertical: Spacing[3], gap: Spacing[2],
  },
  symbol:      { fontSize: 28, fontWeight: '600', marginBottom: 6 },
  amountInput: { fontSize: 56, fontWeight: '700', letterSpacing: -2, minWidth: 120, textAlign: 'center' },

  label:        { ...Typography.labelLarge },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  catItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3.5], paddingVertical: Spacing[2.5], borderRadius: BorderRadius.xl,
  },
  catEmoji: { fontSize: 18 },
  catName:  { ...Typography.labelLarge },
});
