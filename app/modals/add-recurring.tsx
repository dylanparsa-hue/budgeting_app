import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useRecurringStore }   from '../../src/stores/recurringStore';
import { Button }              from '../../src/components/ui/Button';
import { useTheme }            from '../../src/theme/ThemeContext';
import { Typography }          from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';
import { parseCurrencyInput }  from '../../src/utils/currency';
import { hapticSelect, hapticSuccess } from '../../src/utils/haptics';
import { RecurringCategory, RecurringFrequency } from '../../src/types';
import { BILL_META, X, AlertTriangle } from '../../src/lib/icons';
import { useTranslation } from 'react-i18next';

const CATEGORY_KEYS: { value: RecurringCategory; labelKey: string }[] = [
  { value: 'rent',         labelKey: 'addRecurring.catRent'         },
  { value: 'utilities',    labelKey: 'addRecurring.catUtilities'    },
  { value: 'subscription', labelKey: 'addRecurring.catSubscription' },
  { value: 'debt',         labelKey: 'addRecurring.catDebt'         },
  { value: 'insurance',    labelKey: 'addRecurring.catInsurance'    },
  { value: 'transport',    labelKey: 'addRecurring.catTransport'    },
  { value: 'other',        labelKey: 'addRecurring.catOther'        },
];

const FREQUENCY_KEYS: { value: RecurringFrequency; labelKey: string }[] = [
  { value: 'monthly', labelKey: 'addRecurring.monthly' },
  { value: 'weekly',  labelKey: 'addRecurring.weekly'  },
  { value: 'yearly',  labelKey: 'addRecurring.yearly'  },
];

export default function AddRecurringModal() {
  const C = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { items, add, edit } = useRecurringStore();

  const existing  = id ? items.find(i => i.id === id) : null;
  const isEditing = !!existing;

  const [name,      setName]      = useState(existing?.name ?? '');
  const [amountStr, setAmountStr] = useState(existing ? String(existing.amount) : '');
  const [category,  setCategory]  = useState<RecurringCategory>(existing?.category ?? 'rent');
  const [frequency, setFrequency] = useState<RecurringFrequency>(existing?.frequency ?? 'monthly');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError('Please enter a name.'); return; }
    const amount = parseCurrencyInput(amountStr);
    if (amount <= 0) { setError('Please enter a valid amount.'); return; }

    setSaving(true);
    try {
      if (isEditing && existing) {
        await edit(existing.id, { name: name.trim(), amount, category, frequency, deductFromIncome: existing.deductFromIncome });
      } else {
        await add({ name: name.trim(), amount, category, frequency, deductFromIncome: false });
      }
      hapticSuccess();
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/plan');
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/plan')}
            style={[styles.closeBtn, { backgroundColor: C.surfaceRaised }]}
          >
            <X size={16} color={C.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
            {isEditing ? t('addRecurring.titleEdit') : t('addRecurring.titleAdd')}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: C.dangerLight }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} color={C.danger} strokeWidth={2} />
                <Text style={[styles.errorText, { color: C.danger, flex: 1 }]}>{error}</Text>
              </View>
            </View>
          ) : null}

          {/* Name */}
          <View>
            <Text style={[styles.label, { color: C.textPrimary }]}>{t('addRecurring.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('addRecurring.namePlaceholder')}
              placeholderTextColor={C.textTertiary}
              style={[styles.textInput, { color: C.textPrimary, backgroundColor: C.surfaceRaised, borderColor: C.border }]}
              autoFocus={!isEditing}
              maxLength={60}
            />
          </View>

          {/* Amount */}
          <View>
            <Text style={[styles.label, { color: C.textPrimary }]}>{t('addRecurring.amount')}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={C.textTertiary}
              style={[styles.textInput, { color: C.textPrimary, backgroundColor: C.surfaceRaised, borderColor: C.border }]}
              maxLength={12}
            />
          </View>

          {/* Frequency */}
          <View>
            <Text style={[styles.label, { color: C.textPrimary }]}>{t('addRecurring.frequency')}</Text>
            <View style={styles.segmentRow}>
              {FREQUENCY_KEYS.map(f => (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => { hapticSelect(); setFrequency(f.value); }}
                  style={[
                    styles.segmentBtn,
                    { backgroundColor: C.surfaceRaised },
                    frequency === f.value && { backgroundColor: C.primary },
                  ]}
                >
                  <Text style={[styles.segmentText, { color: frequency === f.value ? '#fff' : C.textSecondary }]}>
                    {t(f.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category */}
          <View>
            <Text style={[styles.label, { color: C.textPrimary }]}>{t('addRecurring.category')}</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_KEYS.map(cat => {
                const selected = category === cat.value;
                const meta = BILL_META[cat.value] ?? BILL_META.other;
                const CatIcon = meta.Icon;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => { hapticSelect(); setCategory(cat.value); }}
                    style={[
                      styles.catItem,
                      { backgroundColor: C.surfaceRaised },
                      selected && { backgroundColor: C.primary },
                    ]}
                  >
                    <CatIcon size={16} color={selected ? '#fff' : meta.color} strokeWidth={2} />
                    <Text style={[styles.catLabel, { color: selected ? '#fff' : C.textPrimary }]}>
                      {t(cat.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Button
            label={saving ? t('finances.saving') : (isEditing ? t('addRecurring.saveChanges') : t('addRecurring.addExpense'))}
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing[2] }}
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
  closeBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16 },
  headerTitle:  { ...Typography.titleMedium },

  content:  { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], gap: Spacing[5], paddingBottom: Spacing[10] },
  label:    { ...Typography.labelLarge, marginBottom: Spacing[2] },
  errorBox: { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText:{ ...Typography.bodySmall },

  textInput: {
    ...Typography.bodyLarge,
    borderWidth: 1, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    textAlign: (I18nManager.isRTL ? 'right' : 'left') as 'right' | 'left',
  },

  segmentRow: { flexDirection: 'row', gap: Spacing[2] },
  segmentBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing[3],
    borderRadius: BorderRadius.xl,
  },
  segmentText: { ...Typography.labelLarge },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  catItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2.5],
    borderRadius: BorderRadius.xl,
  },
  catIcon:  { fontSize: 16 },
  catLabel: { ...Typography.labelSmall },
});
