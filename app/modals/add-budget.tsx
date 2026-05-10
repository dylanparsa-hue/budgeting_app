import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useBudgetStore }      from '../../src/stores/budgetStore';
import { Button }   from '../../src/components/ui/Button';
import { Colors }   from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';
import { getExpenseCategories } from '../../src/utils/categories';
import { parseCurrencyInput }   from '../../src/utils/currency';

const now   = new Date();
const MONTH = now.getMonth() + 1;
const YEAR  = now.getFullYear();

export default function AddBudgetModal() {
  const { user, profile }                  = useAuthStore();
  const { categories }                     = useTransactionStore();
  const { saveBudget }                     = useBudgetStore();
  const [categoryId, setCategoryId]        = useState('');
  const [amountStr,  setAmountStr]         = useState('');
  const [isSaving,   setIsSaving]          = useState(false);

  const expenseCategories = getExpenseCategories(categories);
  const currency          = profile?.currency ?? 'MYR';
  const symbol            = currency === 'MYR' ? 'RM' : currency;

  useEffect(() => {
    if (expenseCategories.length > 0 && !categoryId) {
      setCategoryId(expenseCategories[0].id);
    }
  }, [expenseCategories.length]);

  const handleSave = async () => {
    const amount = parseCurrencyInput(amountStr);
    if (amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a budget amount.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Select a category', 'Please choose a category.');
      return;
    }
    if (!user) return;

    setIsSaving(true);
    try {
      await saveBudget({
        user_id:     user.id,
        group_id:    null,
        category_id: categoryId,
        amount,
        period:      'monthly',
        month:       MONTH,
        year:        YEAR,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save budget.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Set Budget</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>
            Set a monthly spending limit for a category
          </Text>

          {/* Amount */}
          <View style={styles.amountBlock}>
            <Text style={styles.symbol}>{symbol}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              style={styles.amountInput}
              autoFocus
              maxLength={10}
            />
          </View>

          {/* Category grid */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {expenseCategories.map(cat => {
              const selected = categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => { Haptics.selectionAsync(); setCategoryId(cat.id); }}
                  style={[styles.catItem, selected && { backgroundColor: cat.color }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.catEmoji}>{cat.icon}</Text>
                  <Text style={[styles.catName, selected && { color: Colors.white }]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            label={isSaving ? 'Saving…' : 'Set Budget'}
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
  safe: { flex: 1, backgroundColor: Colors.white },
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, color: Colors.textSecondary },
  headerTitle: { ...Typography.titleMedium, color: Colors.textPrimary },

  content: {
    paddingHorizontal: Spacing[5],
    paddingTop:        Spacing[5],
    gap:               Spacing[5],
    paddingBottom:     Spacing[10],
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  amountBlock: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'center',
    paddingVertical: Spacing[3],
    gap:            Spacing[2],
  },
  symbol: {
    fontSize: 28, fontWeight: '600',
    color: Colors.textSecondary, marginBottom: 6,
  },
  amountInput: {
    fontSize: 56, fontWeight: '700',
    color: Colors.textPrimary, letterSpacing: -2,
    minWidth: 120, textAlign: 'center',
  },
  label: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing[2],
  },
  catItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing[2],
    paddingHorizontal: Spacing[3.5],
    paddingVertical:   Spacing[2.5],
    borderRadius:      BorderRadius.xl,
    backgroundColor:   Colors.surfaceRaised,
  },
  catEmoji: { fontSize: 18 },
  catName: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
  },
});
