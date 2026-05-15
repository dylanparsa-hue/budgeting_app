import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput, Modal, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { hapticSelect, hapticSuccess } from '../../src/utils/haptics';
import { useTranslation } from 'react-i18next';

import { useAuthStore }        from '../../src/stores/authStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useBudgetStore }      from '../../src/stores/budgetStore';
import { Button }   from '../../src/components/ui/Button';
import { useTheme } from '../../src/theme/ThemeContext';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';
import { getExpenseCategories }  from '../../src/utils/categories';
import { parseCurrencyInput }    from '../../src/utils/currency';
import { X, AlertTriangle, Trash2, CATEGORY_ICON } from '../../src/lib/icons';
import { Package } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

const now   = new Date();
const MONTH = now.getMonth() + 1;
const YEAR  = now.getFullYear();

export default function AddBudgetModal() {
  const C = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, profile }                           = useAuthStore();
  const { categories }                              = useTransactionStore();
  const { budgets, saveBudget, removeBudget }       = useBudgetStore();

  const existing  = id ? budgets.find(b => b.id === id) : null;
  const isEditing = !!existing;

  const [categoryId, setCategoryId]         = useState(existing?.category_id ?? '');
  const [amountStr,  setAmountStr]          = useState(existing ? String(existing.amount) : '');
  const [isSaving,   setIsSaving]           = useState(false);
  const [isDeleting, setIsDeleting]         = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error,      setError]              = useState('');

  const expenseCategories = getExpenseCategories(categories);
  const currency          = profile?.currency ?? 'MYR';
  const symbol            = currency === 'MYR' ? 'RM' : currency;

  useEffect(() => {
    if (expenseCategories.length > 0 && !categoryId) {
      setCategoryId(expenseCategories[0].id);
    }
  }, [expenseCategories.length]);

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/budgets');

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
      goBack();
    } catch (err: any) {
      setError(err.message ?? 'Could not save budget. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setIsDeleting(true);
    try {
      await removeBudget(existing.id);
      hapticSuccess();
      setShowDeleteConfirm(false);
      goBack();
    } catch (err: any) {
      setError(err.message ?? 'Could not delete budget. Please try again.');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const catName = existing
    ? (categories.find(c => c.id === existing.category_id)?.name ?? 'this budget')
    : 'this budget';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={goBack} style={[styles.closeBtn, { backgroundColor: C.surfaceRaised }]}>
            <X size={16} color={C.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
            {isEditing ? t('addBudget.titleEdit') : t('addBudget.titleAdd')}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            {isEditing ? t('addBudget.subtitleEdit') : t('addBudget.subtitleAdd')}
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} color={C.danger} strokeWidth={2} />
                <Text style={[styles.errorText, { color: C.danger, flex: 1 }]}>{error}</Text>
              </View>
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
              style={[styles.amountInput, { color: C.textPrimary, textAlign: I18nManager.isRTL ? 'right' : 'center' }]}
              autoFocus={!isEditing}
              maxLength={10}
            />
          </View>

          {/* Category grid */}
          <Text style={[styles.label, { color: C.textPrimary }]}>{t('addBudget.category')}</Text>
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
                  {(() => {
                    const CatIcon: LucideIcon = CATEGORY_ICON[cat.icon?.toLowerCase() ?? ''] ?? CATEGORY_ICON[cat.name?.toLowerCase() ?? ''] ?? Package;
                    return <CatIcon size={18} color={selected ? '#fff' : (cat.color ?? C.textSecondary)} strokeWidth={2} />;
                  })()}
                  <Text style={[styles.catName, { color: selected ? '#fff' : C.textPrimary }]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            label={isSaving ? t('finances.saving') : (isEditing ? t('addBudget.saveChanges') : t('addBudget.titleAdd'))}
            onPress={handleSave}
            loading={isSaving}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing[4] }}
          />

          {isEditing && (
            <TouchableOpacity
              onPress={() => { hapticSelect(); setShowDeleteConfirm(true); }}
              style={[styles.deleteBtn, { borderColor: C.danger + '60' }]}
              activeOpacity={0.75}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Trash2 size={16} color={C.danger} strokeWidth={2} />
                <Text style={[styles.deleteBtnText, { color: C.danger }]}>{t('addBudget.delete')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete confirmation sheet */}
      <Modal visible={showDeleteConfirm} transparent animationType="slide" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowDeleteConfirm(false)} />
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <View style={[styles.deleteIconBox, { backgroundColor: C.dangerLight }]}>
              <Trash2 size={28} color={C.danger} strokeWidth={2} />
            </View>
            <Text style={[styles.deleteModalTitle, { color: C.textPrimary }]}>{t('addBudget.deleteConfirm')}</Text>
            <Text style={[styles.deleteModalBody, { color: C.textSecondary }]}>
              {t('addBudget.deleteMsg')}{'\n'}
              <Text style={{ fontWeight: '700', color: C.textPrimary }}>{catName}</Text>.
            </Text>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={isDeleting}
              style={[styles.deleteConfirmBtn, { backgroundColor: C.danger }]}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteConfirmBtnText}>
                {isDeleting ? t('addTransaction.deleting') : t('addTransaction.deleteConfirmBtn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDeleteConfirm(false)}
              style={[styles.deleteCancelBtn, { backgroundColor: C.surfaceRaised }]}
            >
              <Text style={[styles.deleteCancelBtnText, { color: C.textPrimary }]}>{t('addBudget.keepIt')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  deleteBtn: {
    alignItems: 'center', paddingVertical: Spacing[4],
    borderRadius: BorderRadius.xl, borderWidth: 1.5, marginTop: Spacing[1],
  },
  deleteBtnText: { ...Typography.labelLarge, fontWeight: '600' },

  // Delete confirmation modal
  modalOverlay:  { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'],
    padding: Spacing[6], paddingBottom: Spacing[10], gap: Spacing[4], alignItems: 'center',
  },
  deleteIconBox:      { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  deleteModalIcon:    { fontSize: 28 },
  deleteModalTitle:   { ...Typography.headingSmall, textAlign: 'center' },
  deleteModalBody:    { ...Typography.bodyMedium, textAlign: 'center', lineHeight: 24 },
  deleteConfirmBtn:   {
    width: '100%', alignItems: 'center', paddingVertical: Spacing[4],
    borderRadius: BorderRadius.xl,
  },
  deleteConfirmBtnText: { ...Typography.labelLarge, color: '#fff', fontWeight: '700' },
  deleteCancelBtn: {
    width: '100%', alignItems: 'center', paddingVertical: Spacing[4],
    borderRadius: BorderRadius.xl,
  },
  deleteCancelBtnText: { ...Typography.labelLarge },
});
