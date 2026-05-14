/**
 * Add / Edit Goal Modal
 *
 * Create mode  — navigated to without ?id
 * Edit mode    — navigated to with    ?id=<goalId>
 *
 * Editable fields (both modes):
 *   Name · Target amount · Amount saved so far · Icon · Color
 *
 * Edit-only extras:
 *   Delete goal  (Alert confirmation)
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput, Alert,
} from 'react-native';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuthStore }  from '../../src/stores/authStore';
import { useGoalStore }  from '../../src/stores/goalStore';
import { Button }        from '../../src/components/ui/Button';
import { useTheme }      from '../../src/theme/ThemeContext';
import { Typography }    from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { DEFAULT_GOAL_COLORS } from '../../src/utils/categories';
import { GOAL_ICON_OPTIONS, X, Trash2, AlertTriangle, Check } from '../../src/lib/icons';
import { parseCurrencyInput, formatCurrency } from '../../src/utils/currency';
import { hapticSelect, hapticSuccess } from '../../src/utils/haptics';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function AddGoalModal() {
  const C = useTheme();
  const { user, profile }                    = useAuthStore();
  const { goals, addGoal, updateGoal, removeGoal } = useGoalStore();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const currency = profile?.currency ?? 'MYR';
  const symbol   = currency === 'MYR' ? 'RM' : currency;

  // ── Load existing goal when editing ───────────────────────────────────────
  const existing  = id ? goals.find(g => g.id === id) : null;
  const isEditing = !!existing;

  const [name,       setName]       = useState(existing?.name          ?? '');
  const [targetStr,  setTargetStr]  = useState(existing ? String(existing.target_amount)  : '');
  const [currentStr, setCurrentStr] = useState(existing ? String(existing.current_amount) : '');
  const [icon,       setIcon]       = useState(existing?.icon  ?? GOAL_ICON_OPTIONS[0].key);
  const [color,      setColor]      = useState(existing?.color ?? DEFAULT_GOAL_COLORS[0]);
  const [isSaving,   setIsSaving]   = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error,      setError]      = useState('');

  const targetNum  = parseCurrencyInput(targetStr);
  const currentNum = parseCurrencyInput(currentStr);
  const pct        = targetNum > 0 ? Math.min((currentNum / targetNum) * 100, 100) : 0;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError('');
    if (!name.trim())           { setError('Please enter a goal name.');              return; }
    if (targetNum <= 0)         { setError('Please enter a target amount.');          return; }
    if (currentNum < 0)         { setError('Amount saved cannot be negative.');       return; }
    if (currentNum > targetNum) { setError('Amount saved cannot exceed the target.'); return; }
    if (!user && !isEditing)    return;

    setIsSaving(true);
    try {
      if (isEditing && existing) {
        await updateGoal(existing.id, {
          name:           name.trim(),
          icon, color,
          target_amount:  targetNum,
          current_amount: currentNum,
          is_completed:   currentNum >= targetNum,
        });
      } else {
        await addGoal({
          user_id: user!.id, group_id: null,
          name: name.trim(), icon, color,
          target_amount:  targetNum,
          current_amount: currentNum,
          deadline: null,
          is_completed: currentNum >= targetNum,
        });
      }
      hapticSuccess();
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/goals');
    } catch (err: any) {
      setError(err.message ?? 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      'Delete goal',
      `Remove "${existing?.name ?? 'this goal'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await removeGoal(existing!.id);
              hapticSuccess();
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/goals');
            } catch {
              setError('Could not delete. Please try again.');
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[S.safe, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={[S.header, { borderBottomColor: C.divider }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/goals')}
            style={[S.closeBtn, { backgroundColor: C.surfaceRaised }]}
          >
            <X size={16} color={C.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[S.headerTitle, { color: C.textPrimary }]}>
            {isEditing ? 'Edit Goal' : 'New Goal'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={S.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Error */}
          {!!error && (
            <View style={[S.errorBox, { backgroundColor: C.dangerLight }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} color={C.danger} strokeWidth={2} />
                <Text style={[S.errorText, { color: C.danger, flex: 1 }]}>{error}</Text>
              </View>
            </View>
          )}

          {/* Live preview */}
          <View style={[S.previewCard, { backgroundColor: color + '18', borderColor: color + '40' }]}>
            <View style={[S.previewIconWrap, { backgroundColor: color + '25' }]}>
              {(() => {
                const PreviewIcon = GOAL_ICON_OPTIONS.find(o => o.key === icon)?.Icon ?? GOAL_ICON_OPTIONS[0].Icon;
                return <PreviewIcon size={28} color={color} strokeWidth={2} />;
              })()}
            </View>
            <View style={{ flex: 1, gap: Spacing[1.5] }}>
              <Text style={[S.previewName, { color: C.textPrimary }]} numberOfLines={1}>
                {name || 'My Goal'}
              </Text>
              <Text style={[S.previewAmounts, { color: C.textSecondary }]}>
                {formatCurrency(currentNum, currency)} saved of {symbol}{targetStr || '0'}
              </Text>
              <View style={[S.previewBarTrack, { backgroundColor: color + '25' }]}>
                <View style={[S.previewBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
              </View>
            </View>
            <Text style={[S.previewPct, { color }]}>{pct.toFixed(0)}%</Text>
          </View>

          {/* Name */}
          <View style={S.fieldGroup}>
            <Text style={[S.label, { color: C.textPrimary }]}>Goal Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Emergency Fund, Vacation…"
              placeholderTextColor={C.textTertiary}
              style={[S.textInput, { color: C.textPrimary, backgroundColor: C.surfaceRaised, borderColor: C.border }]}
              autoFocus={!isEditing}
              autoCapitalize="sentences"
              maxLength={40}
            />
          </View>

          {/* Target & current amounts side by side */}
          <View style={S.amountsRow}>
            <View style={[S.fieldGroup, { flex: 1 }]}>
              <Text style={[S.label, { color: C.textPrimary }]}>Target</Text>
              <View style={[S.amountWrap, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
                <Text style={[S.amountSymbol, { color: C.textTertiary }]}>{symbol}</Text>
                <TextInput
                  value={targetStr}
                  onChangeText={setTargetStr}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={C.textTertiary}
                  style={[S.amountInput, { color: C.textPrimary }]}
                  maxLength={12}
                />
              </View>
            </View>

            <View style={[S.fieldGroup, { flex: 1 }]}>
              <Text style={[S.label, { color: C.textPrimary }]}>Saved So Far</Text>
              <View style={[S.amountWrap, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
                <Text style={[S.amountSymbol, { color: C.textTertiary }]}>{symbol}</Text>
                <TextInput
                  value={currentStr}
                  onChangeText={setCurrentStr}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={C.textTertiary}
                  style={[S.amountInput, { color: C.textPrimary }]}
                  maxLength={12}
                />
              </View>
            </View>
          </View>

          {/* Icon picker */}
          <View style={S.fieldGroup}>
            <Text style={[S.label, { color: C.textPrimary }]}>Icon</Text>
            <View style={S.iconGrid}>
              {GOAL_ICON_OPTIONS.map(({ key, Icon }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => { hapticSelect(); setIcon(key); }}
                  style={[
                    S.iconBtn,
                    { backgroundColor: C.surfaceRaised },
                    icon === key && { backgroundColor: color, ...Shadow.sm },
                  ]}
                >
                  <Icon size={20} color={icon === key ? '#fff' : C.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Color picker */}
          <View style={S.fieldGroup}>
            <Text style={[S.label, { color: C.textPrimary }]}>Color</Text>
            <View style={S.colorRow}>
              {DEFAULT_GOAL_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => { hapticSelect(); setColor(c); }}
                  style={[
                    S.colorDot,
                    { backgroundColor: c },
                    color === c && S.colorDotSelected,
                  ]}
                >
                  {color === c && <Check size={12} color="#fff" strokeWidth={3} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Save */}
          <Button
            label={isSaving ? 'Saving…' : (isEditing ? 'Save Changes' : 'Create Goal')}
            onPress={handleSave}
            loading={isSaving}
            fullWidth
            size="lg"
          />

          {/* Delete — edit mode only */}
          {isEditing && (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={isDeleting}
              style={[S.deleteBtn, { backgroundColor: C.dangerLight }]}
              activeOpacity={0.75}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Trash2 size={16} color={C.danger} strokeWidth={2} />
                <Text style={[S.deleteBtnText, { color: C.danger }]}>{isDeleting ? 'Deleting…' : 'Delete Goal'}</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={{ height: Spacing[4] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16 },
  headerTitle:  { ...Typography.titleMedium },

  content:    { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], gap: Spacing[5] },
  fieldGroup: { gap: Spacing[2] },

  errorBox:  { borderRadius: BorderRadius.lg, padding: Spacing[3] },
  errorText: { ...Typography.bodySmall },

  // Preview card
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    borderRadius: BorderRadius['2xl'], padding: Spacing[4], borderWidth: 1,
  },
  previewIconWrap: {
    width: 52, height: 52, borderRadius: BorderRadius.xl,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  previewIconText: { fontSize: 28 },
  previewName:     { ...Typography.titleSmall, fontWeight: '700' },
  previewAmounts:  { ...Typography.caption },
  previewBarTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  previewBarFill:  { height: '100%', borderRadius: 3 },
  previewPct:      { ...Typography.titleSmall, fontWeight: '800', minWidth: 38, textAlign: 'right' },

  label: { ...Typography.labelLarge },

  // Text input
  textInput: {
    ...Typography.bodyLarge,
    borderWidth: 1, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
  },

  // Amount fields
  amountsRow: { flexDirection: 'row', gap: Spacing[3] },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[1.5],
    borderWidth: 1, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2.5],
  },
  amountSymbol: { ...Typography.bodyMedium, fontWeight: '600' },
  amountInput:  { flex: 1, ...Typography.titleSmall, fontWeight: '700', padding: 0 },

  // Icon picker
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  iconBtn: {
    width: 48, height: 48, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: 24 },

  // Color picker
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  colorDot: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 5, elevation: 5,
  },
  colorCheck: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // Delete button
  deleteBtn: {
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[3.5],
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { ...Typography.labelLarge, fontWeight: '700' },
});
