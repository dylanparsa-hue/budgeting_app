import React, { useState } from 'react';
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

import { useAuthStore } from '../../src/stores/authStore';
import { useGoalStore } from '../../src/stores/goalStore';
import { Button }       from '../../src/components/ui/Button';
import { Input }        from '../../src/components/ui/Input';
import { Colors }       from '../../src/theme/colors';
import { Typography }   from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';
import { DEFAULT_GOAL_ICONS, DEFAULT_GOAL_COLORS } from '../../src/utils/categories';
import { parseCurrencyInput } from '../../src/utils/currency';

export default function AddGoalModal() {
  const { user, profile } = useAuthStore();
  const { addGoal }       = useGoalStore();

  const [name,      setName]      = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [icon,      setIcon]      = useState(DEFAULT_GOAL_ICONS[0]);
  const [color,     setColor]     = useState(DEFAULT_GOAL_COLORS[0]);
  const [isSaving,  setIsSaving]  = useState(false);

  const currency = profile?.currency ?? 'MYR';
  const symbol   = currency === 'MYR' ? 'RM' : currency;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a goal name.');
      return;
    }
    const amount = parseCurrencyInput(amountStr);
    if (amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a target amount.');
      return;
    }
    if (!user) return;

    setIsSaving(true);
    try {
      await addGoal({
        user_id:        user.id,
        group_id:       null,
        name:           name.trim(),
        icon,
        color,
        target_amount:  amount,
        current_amount: 0,
        deadline:       null,
        is_completed:   false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not create goal.');
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
          <Text style={styles.headerTitle}>New Goal</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Preview */}
          <View style={[styles.preview, { backgroundColor: color }]}>
            <Text style={styles.previewIcon}>{icon}</Text>
            <Text style={styles.previewName}>{name || 'My Goal'}</Text>
            <Text style={styles.previewAmount}>
              Target: {symbol}{amountStr || '0'}
            </Text>
          </View>

          {/* Goal name */}
          <Input
            label="Goal Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Emergency Fund, Vacation…"
            autoCapitalize="sentences"
            maxLength={40}
          />

          {/* Target amount */}
          <View>
            <Text style={styles.label}>Target Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.symbol}>{symbol}</Text>
              <TextInput
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                style={styles.amountInput}
                maxLength={10}
              />
            </View>
          </View>

          {/* Icon picker */}
          <View>
            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {DEFAULT_GOAL_ICONS.map(i => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { Haptics.selectionAsync(); setIcon(i); }}
                  style={[styles.iconBtn, icon === i && { backgroundColor: color }]}
                >
                  <Text style={styles.iconEmoji}>{i}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Color picker */}
          <View>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {DEFAULT_GOAL_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => { Haptics.selectionAsync(); setColor(c); }}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && styles.colorDotSelected,
                  ]}
                >
                  {color === c && <Text style={styles.colorCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Button
            label={isSaving ? 'Creating…' : 'Create Goal'}
            onPress={handleSave}
            loading={isSaving}
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
  safe: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4],
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, color: Colors.textSecondary },
  headerTitle:  { ...Typography.titleMedium, color: Colors.textPrimary },

  content: {
    paddingHorizontal: Spacing[5],
    paddingTop:        Spacing[5],
    gap:               Spacing[5],
    paddingBottom:     Spacing[10],
  },

  preview: {
    borderRadius: BorderRadius['2xl'],
    padding:      Spacing[6],
    alignItems:   'center',
    gap:          Spacing[1],
  },
  previewIcon:   { fontSize: 40 },
  previewName:   { ...Typography.headingSmall, color: Colors.white },
  previewAmount: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.8)' },

  label: { ...Typography.labelLarge, color: Colors.textPrimary },

  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: Spacing[2], gap: Spacing[2],
  },
  symbol:      { fontSize: 24, fontWeight: '600', color: Colors.textSecondary },
  amountInput: {
    flex: 1, fontSize: 36, fontWeight: '700',
    color: Colors.textPrimary, letterSpacing: -1,
    borderBottomWidth: 2, borderBottomColor: Colors.primary,
    paddingBottom: Spacing[1],
  },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginTop: Spacing[2] },
  iconBtn: {
    width: 48, height: 48, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: 24 },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3], marginTop: Spacing[2] },
  colorDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 3, borderColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  colorCheck: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
