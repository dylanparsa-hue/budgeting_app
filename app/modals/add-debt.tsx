import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { hapticSelect, hapticSuccess } from '../../src/utils/haptics';
import { useDebtStore }  from '../../src/stores/debtStore';
import { Button }        from '../../src/components/ui/Button';
import { useTheme }      from '../../src/theme/ThemeContext';
import { Typography }    from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';
import { parseCurrencyInput, formatCurrency } from '../../src/utils/currency';
import { useAuthStore }  from '../../src/stores/authStore';
import { X, AlertTriangle, Trash2 } from 'lucide-react-native';
import { CreditCard } from 'lucide-react-native';

export default function AddDebtModal() {
  const C = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { debts, add, edit, remove } = useDebtStore();
  const { profile } = useAuthStore();

  const existing  = id ? debts.find(d => d.id === id) : null;
  const isEditing = !!existing;
  const currency  = profile?.currency ?? 'MYR';

  const [name,         setName]         = useState(existing?.name ?? '');
  const [lender,       setLender]       = useState(existing?.lender ?? '');
  const [totalStr,     setTotalStr]     = useState(existing ? String(existing.totalAmount) : '');
  const [paidStr,      setPaidStr]      = useState(existing ? String(existing.amountPaid) : '0');
  const [dueDate,      setDueDate]      = useState(existing?.dueDate ?? '');
  const [interestStr,  setInterestStr]  = useState(existing?.interestRate != null ? String(existing.interestRate) : '');
  const [notes,        setNotes]        = useState(existing?.notes ?? '');
  const [isSaving,     setIsSaving]     = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [error,        setError]        = useState('');

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/goals');

  const handleSave = async () => {
    setError('');
    const total = parseCurrencyInput(totalStr);
    if (!name.trim())  { setError('Please enter a name for this debt.'); return; }
    if (!lender.trim()){ setError('Please enter who you owe this to.'); return; }
    if (total <= 0)    { setError('Please enter the total debt amount.'); return; }

    const paid         = Math.min(parseCurrencyInput(paidStr) || 0, total);
    const interestRate = interestStr ? parseFloat(interestStr) : null;
    const dueDateVal   = dueDate.trim() || null;

    setIsSaving(true);
    try {
      const data = {
        name:         name.trim(),
        lender:       lender.trim(),
        totalAmount:  total,
        amountPaid:   paid,
        dueDate:      dueDateVal,
        interestRate: isNaN(interestRate as any) ? null : interestRate,
        notes:        notes.trim() || null,
      };
      if (isEditing && existing) {
        await edit(existing.id, data);
      } else {
        await add(data);
      }
      hapticSuccess();
      goBack();
    } catch (err: any) {
      setError(err.message ?? 'Could not save debt. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setIsDeleting(true);
    try {
      await remove(existing.id);
      hapticSuccess();
      setShowDelete(false);
      goBack();
    } catch (err: any) {
      setError(err.message ?? 'Could not delete. Please try again.');
      setShowDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={goBack} style={[styles.closeBtn, { backgroundColor: C.surfaceRaised }]}>
            <X size={16} color={C.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
            {isEditing ? 'Edit Debt' : 'Track a Debt'}
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

          <Field label="What is this debt for?" C={C}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Car loan, Credit card..."
              placeholderTextColor={C.textTertiary}
              style={[styles.input, { color: C.textPrimary, backgroundColor: C.surfaceRaised, borderColor: C.border }]}
            />
          </Field>

          <Field label="Who do you owe?" C={C}>
            <TextInput
              value={lender}
              onChangeText={setLender}
              placeholder="e.g. Bank, Friend, Finance company..."
              placeholderTextColor={C.textTertiary}
              style={[styles.input, { color: C.textPrimary, backgroundColor: C.surfaceRaised, borderColor: C.border }]}
            />
          </Field>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Total amount" C={C}>
                <View style={[styles.inputPrefixRow, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
                  <Text style={[styles.inputPrefix, { color: C.textTertiary }]}>{currency === 'MYR' ? 'RM' : currency}</Text>
                  <TextInput
                    value={totalStr}
                    onChangeText={setTotalStr}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={C.textTertiary}
                    style={[styles.inputInner, { color: C.textPrimary }]}
                  />
                </View>
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Already paid" C={C}>
                <View style={[styles.inputPrefixRow, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
                  <Text style={[styles.inputPrefix, { color: C.textTertiary }]}>{currency === 'MYR' ? 'RM' : currency}</Text>
                  <TextInput
                    value={paidStr}
                    onChangeText={setPaidStr}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={C.textTertiary}
                    style={[styles.inputInner, { color: C.textPrimary }]}
                  />
                </View>
              </Field>
            </View>
          </View>

          <Field label="Due date (YYYY-MM-DD)" sublabel="Optional — used for time priority" C={C}>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="e.g. 2025-12-31"
              placeholderTextColor={C.textTertiary}
              style={[styles.input, { color: C.textPrimary, backgroundColor: C.surfaceRaised, borderColor: C.border }]}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
            />
          </Field>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Interest rate %" sublabel="Optional" C={C}>
                <TextInput
                  value={interestStr}
                  onChangeText={setInterestStr}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 4.5"
                  placeholderTextColor={C.textTertiary}
                  style={[styles.input, { color: C.textPrimary, backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                />
              </Field>
            </View>
          </View>

          <Field label="Notes" sublabel="Optional" C={C}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any extra details..."
              placeholderTextColor={C.textTertiary}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea, { color: C.textPrimary, backgroundColor: C.surfaceRaised, borderColor: C.border }]}
            />
          </Field>

          <Button
            label={isSaving ? 'Saving…' : (isEditing ? 'Save Changes' : 'Track Debt')}
            onPress={handleSave}
            loading={isSaving}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing[2] }}
          />

          {isEditing && (
            <TouchableOpacity
              onPress={() => { hapticSelect(); setShowDelete(true); }}
              style={[styles.deleteBtn, { borderColor: C.danger + '60' }]}
              activeOpacity={0.75}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Trash2 size={16} color={C.danger} strokeWidth={2} />
                <Text style={[styles.deleteBtnText, { color: C.danger }]}>Delete debt</Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete confirmation */}
      <Modal visible={showDelete} transparent animationType="slide" onRequestClose={() => setShowDelete(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowDelete(false)} />
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <View style={[styles.deleteIconBox, { backgroundColor: C.dangerLight }]}>
              <CreditCard size={28} color={C.danger} strokeWidth={2} />
            </View>
            <Text style={[styles.deleteModalTitle, { color: C.textPrimary }]}>Remove Debt?</Text>
            <Text style={[styles.deleteModalBody, { color: C.textSecondary }]}>
              This will remove{' '}
              <Text style={{ fontWeight: '700', color: C.textPrimary }}>{existing?.name}</Text>
              {' '}from your debt tracker.
            </Text>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={isDeleting}
              style={[styles.deleteConfirmBtn, { backgroundColor: C.danger }]}
            >
              <Text style={styles.deleteConfirmBtnText}>{isDeleting ? 'Removing…' : 'Yes, remove it'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDelete(false)}
              style={[styles.deleteCancelBtn, { backgroundColor: C.surfaceRaised }]}
            >
              <Text style={[styles.deleteCancelBtnText, { color: C.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, sublabel, children, C }: { label: string; sublabel?: string; children: React.ReactNode; C: any }) {
  return (
    <View style={fieldStyles.wrapper}>
      <View style={fieldStyles.labelRow}>
        <Text style={[fieldStyles.label, { color: C.textPrimary }]}>{label}</Text>
        {sublabel && <Text style={[fieldStyles.sublabel, { color: C.textTertiary }]}>{sublabel}</Text>}
      </View>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper:  { gap: Spacing[1.5] },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing[2] },
  label:    { ...Typography.labelLarge },
  sublabel: { ...Typography.caption },
});

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
  errorBox: { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText:{ ...Typography.bodySmall },

  row: { flexDirection: 'row', gap: Spacing[3] },

  input: {
    borderRadius: BorderRadius.lg, borderWidth: 1,
    paddingHorizontal: Spacing[3.5], paddingVertical: Spacing[3],
    ...Typography.bodyMedium,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  inputPrefixRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.lg, borderWidth: 1,
    paddingHorizontal: Spacing[3.5],
  },
  inputPrefix: { ...Typography.bodySmall, marginRight: Spacing[1] },
  inputInner:  { flex: 1, ...Typography.bodyMedium, paddingVertical: Spacing[3] },

  deleteBtn: {
    alignItems: 'center', paddingVertical: Spacing[4],
    borderRadius: BorderRadius.xl, borderWidth: 1.5,
  },
  deleteBtnText: { ...Typography.labelLarge, fontWeight: '600' },

  modalOverlay:  { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'],
    padding: Spacing[6], paddingBottom: Spacing[10], gap: Spacing[4], alignItems: 'center',
  },
  deleteIconBox:        { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  deleteModalTitle:     { ...Typography.headingSmall, textAlign: 'center' },
  deleteModalBody:      { ...Typography.bodyMedium, textAlign: 'center', lineHeight: 24 },
  deleteConfirmBtn:     { width: '100%', alignItems: 'center', paddingVertical: Spacing[4], borderRadius: BorderRadius.xl },
  deleteConfirmBtnText: { ...Typography.labelLarge, color: '#fff', fontWeight: '700' },
  deleteCancelBtn:      { width: '100%', alignItems: 'center', paddingVertical: Spacing[4], borderRadius: BorderRadius.xl },
  deleteCancelBtnText:  { ...Typography.labelLarge },
});
