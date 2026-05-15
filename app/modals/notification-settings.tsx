import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useNotificationStore, DEFAULT_PREFS } from '../../src/stores/notificationStore';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme/ThemeContext';
import { Typography } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { BarChart2, Target, Shield, Sparkles, Bell, Info, X, Check } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export default function NotificationSettingsScreen() {
  const C             = useTheme();
  const { t }         = useTranslation();
  const { prefs, updateCategory, resetPrefs, clearDismissed, load } = useNotificationStore();
  const [saveAnim, setSaveAnim] = useState(false);

  useEffect(() => { load(); }, []);

  const toggle = <
    K extends keyof typeof prefs,
    F extends keyof (typeof prefs)[K],
  >(category: K, field: F, value: boolean) => {
    updateCategory(category, { [field]: value } as any);
  };

  const setThreshold = <K extends keyof typeof prefs>(
    category: K,
    field: keyof (typeof prefs)[K],
    raw: string,
  ) => {
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) updateCategory(category, { [field]: num } as any);
  };

  const handleReset = async () => {
    await resetPrefs();
    await clearDismissed();
    setSaveAnim(true);
    setTimeout(() => setSaveAnim(false), 1500);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: C.divider }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <X size={16} color={C.primary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>{t('notifications.title')}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Info banner */}
          <View style={[styles.infoBanner, { backgroundColor: C.primaryLight }]}>
            <Info size={16} color={C.primary} strokeWidth={2} />
            <Text style={[styles.infoText, { color: C.primary }]}>
              {t('notifications.infoBanner')}
            </Text>
          </View>

          {/* ── 1. Financial Awareness ───────────────────────── */}
          <Section
            Icon={BarChart2}
            title={t('notifications.financialAwareness')}
            subtitle={t('notifications.financialAwarenessSub')}
            enabled={prefs.financialAwareness.enabled}
            onToggle={v => toggle('financialAwareness', 'enabled', v)}
            C={C}
          >
            <Toggle
              label={t('notifications.spendingHabits')}
              description={t('notifications.spendingHabitsSub')}
              value={prefs.financialAwareness.spendingHabits}
              disabled={!prefs.financialAwareness.enabled}
              onChange={v => toggle('financialAwareness', 'spendingHabits', v)}
              C={C}
            />
            <Divider C={C} />
            <Toggle
              label={t('notifications.unusualSpending')}
              description={t('notifications.unusualSpendingSub')}
              value={prefs.financialAwareness.unusualSpending}
              disabled={!prefs.financialAwareness.enabled}
              onChange={v => toggle('financialAwareness', 'unusualSpending', v)}
              C={C}
            />
            <Divider C={C} />
            <Toggle
              label={t('notifications.largePurchase')}
              description={t('notifications.largePurchaseSub')}
              value={prefs.financialAwareness.largePurchase}
              disabled={!prefs.financialAwareness.enabled}
              onChange={v => toggle('financialAwareness', 'largePurchase', v)}
              C={C}
            />
            {prefs.financialAwareness.largePurchase && prefs.financialAwareness.enabled && (
              <ThresholdInput
                label={t('notifications.largePurchaseThreshold')}
                value={prefs.financialAwareness.largePurchaseThreshold.toString()}
                onChangeText={v => setThreshold('financialAwareness', 'largePurchaseThreshold', v)}
                C={C}
              />
            )}
          </Section>

          {/* ── 2. Budget Control ────────────────────────────── */}
          <Section
            Icon={Target}
            title={t('notifications.budgetControl')}
            subtitle={t('notifications.budgetControlSub')}
            enabled={prefs.budgetControl.enabled}
            onToggle={v => toggle('budgetControl', 'enabled', v)}
            C={C}
          >
            <Toggle
              label={t('notifications.categoryAlerts')}
              description={t('notifications.categoryAlertsSub')}
              value={prefs.budgetControl.categoryAlerts}
              disabled={!prefs.budgetControl.enabled}
              onChange={v => toggle('budgetControl', 'categoryAlerts', v)}
              C={C}
            />
            {prefs.budgetControl.enabled && (
              <ThresholdInput
                label={t('notifications.warnAt')}
                value={prefs.budgetControl.warningAt.toString()}
                suffix="%"
                onChangeText={v => setThreshold('budgetControl', 'warningAt', v)}
                C={C}
              />
            )}
          </Section>

          {/* ── 3. Account Protection ────────────────────────── */}
          <Section
            Icon={Shield}
            title={t('notifications.accountProtection')}
            subtitle={t('notifications.accountProtectionSub')}
            enabled={prefs.accountProtection.enabled}
            onToggle={v => toggle('accountProtection', 'enabled', v)}
            C={C}
          >
            <Toggle
              label={t('notifications.lowBalance')}
              description={t('notifications.lowBalanceSub')}
              value={prefs.accountProtection.lowBalance}
              disabled={!prefs.accountProtection.enabled}
              onChange={v => toggle('accountProtection', 'lowBalance', v)}
              C={C}
            />
            {prefs.accountProtection.lowBalance && prefs.accountProtection.enabled && (
              <ThresholdInput
                label={t('notifications.lowBalanceThreshold')}
                value={prefs.accountProtection.lowBalanceThreshold.toString()}
                onChangeText={v => setThreshold('accountProtection', 'lowBalanceThreshold', v)}
                C={C}
              />
            )}
            <Divider C={C} />
            <Toggle
              label={t('notifications.overdraftRisk')}
              description={t('notifications.overdraftRiskSub')}
              value={prefs.accountProtection.overdraftRisk}
              disabled={!prefs.accountProtection.enabled}
              onChange={v => toggle('accountProtection', 'overdraftRisk', v)}
              C={C}
            />
            <Divider C={C} />
            <Toggle
              label={t('notifications.billReminders')}
              description={t('notifications.billRemindersSub')}
              value={prefs.accountProtection.billReminders}
              disabled={!prefs.accountProtection.enabled}
              onChange={v => toggle('accountProtection', 'billReminders', v)}
              C={C}
            />
          </Section>

          {/* ── 4. Motivation & Goals ────────────────────────── */}
          <Section
            Icon={Sparkles}
            title={t('notifications.motivation')}
            subtitle={t('notifications.motivationSub')}
            enabled={prefs.motivation.enabled}
            onToggle={v => toggle('motivation', 'enabled', v)}
            C={C}
          >
            <Toggle
              label={t('notifications.goalProgress')}
              description={t('notifications.goalProgressSub')}
              value={prefs.motivation.goalProgress}
              disabled={!prefs.motivation.enabled}
              onChange={v => toggle('motivation', 'goalProgress', v)}
              C={C}
            />
            <Divider C={C} />
            <Toggle
              label={t('notifications.monthlyComparison')}
              description={t('notifications.monthlyComparisonSub')}
              value={prefs.motivation.monthlyComparison}
              disabled={!prefs.motivation.enabled}
              onChange={v => toggle('motivation', 'monthlyComparison', v)}
              C={C}
            />
            <Divider C={C} />
            <Toggle
              label={t('notifications.positiveReinforcement')}
              description={t('notifications.positiveReinforcementSub')}
              value={prefs.motivation.positiveReinforcement}
              disabled={!prefs.motivation.enabled}
              onChange={v => toggle('motivation', 'positiveReinforcement', v)}
              C={C}
            />
          </Section>

          {/* ── Push notifications (coming soon) ─────────────── */}
          <View style={[styles.sectionCard, { backgroundColor: C.surface }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: C.divider }]}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}><Bell size={16} color={C.textSecondary} strokeWidth={2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>{t('notifications.pushTitle')}</Text>
                  <Text style={[styles.sectionSubtitle, { color: C.textTertiary }]}>{t('notifications.pushSub')}</Text>
                </View>
                <View style={[styles.comingSoonBadge, { backgroundColor: C.primaryLight }]}>
                  <Text style={[styles.comingSoonText, { color: C.primary }]}>{t('notifications.comingSoon')}</Text>
                </View>
              </View>
            </View>
            <View style={styles.sectionBody}>
              <Text style={[styles.pushNote, { color: C.textTertiary }]}>
                {t('notifications.pushNote')}
              </Text>
            </View>
          </View>

          {/* ── Reset ─────────────────────────────────────────── */}
          <View style={{ gap: Spacing[3] }}>
            <TouchableOpacity
              onPress={clearDismissed}
              style={[styles.secondaryBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            >
              <Text style={[styles.secondaryBtnText, { color: C.textSecondary }]}>{t('notifications.restoreDismissed')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.secondaryBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {saveAnim && <Check size={13} color={C.danger} strokeWidth={2.5} />}
                <Text style={[styles.secondaryBtnText, { color: C.danger }]}>
                  {saveAnim ? t('notifications.resetDone') : t('notifications.resetAll')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: Spacing[8] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  Icon, title, subtitle, enabled, onToggle, children, C,
}: {
  Icon: LucideIcon; title: string; subtitle: string;
  enabled: boolean; onToggle: (v: boolean) => void;
  children: React.ReactNode; C: any;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: C.surface }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: C.divider }]}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIconWrap}><Icon size={16} color={C.textSecondary} strokeWidth={2} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>{title}</Text>
            <Text style={[styles.sectionSubtitle, { color: C.textTertiary }]}>{subtitle}</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: C.border, true: C.primary + '60' }}
            thumbColor={enabled ? C.primary : C.textTertiary}
          />
        </View>
      </View>
      <View style={[styles.sectionBody, !enabled && styles.dimmed]}>
        {children}
      </View>
    </View>
  );
}

function Toggle({
  label, description, value, disabled, onChange, C,
}: {
  label: string; description: string; value: boolean;
  disabled: boolean; onChange: (v: boolean) => void; C: any;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.toggleLabel, { color: disabled ? C.textTertiary : C.textPrimary }]}>{label}</Text>
        <Text style={[styles.toggleDesc,  { color: C.textTertiary }]}>{description}</Text>
      </View>
      <Switch
        value={value && !disabled}
        onValueChange={disabled ? undefined : onChange}
        disabled={disabled}
        trackColor={{ false: C.border, true: C.primary + '60' }}
        thumbColor={(value && !disabled) ? C.primary : C.textTertiary}
      />
    </View>
  );
}

function ThresholdInput({
  label, value, suffix, onChangeText, C,
}: {
  label: string; value: string; suffix?: string; onChangeText: (v: string) => void; C: any;
}) {
  return (
    <View style={[styles.thresholdRow, { borderTopColor: C.divider }]}>
      <Text style={[styles.toggleLabel, { color: C.textPrimary, flex: 1 }]}>{label}</Text>
      <View style={[styles.thresholdInputWrap, { backgroundColor: C.background, borderColor: C.border }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          returnKeyType="done"
          style={[styles.thresholdInput, { color: C.textPrimary }]}
          selectTextOnFocus
        />
        {suffix && <Text style={[styles.thresholdSuffix, { color: C.textTertiary }]}>{suffix}</Text>}
      </View>
    </View>
  );
}

function Divider({ C }: { C: any }) {
  return <View style={[styles.divider, { backgroundColor: C.divider }]} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1 },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.titleMedium, fontWeight: '700' },

  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: Spacing[4] },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  infoText: { ...Typography.bodySmall, flex: 1, lineHeight: 18 },

  // Section card
  sectionCard:     { borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.sm },
  sectionHeader:   { paddingHorizontal: Spacing[4], paddingVertical: Spacing[4], borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:    { ...Typography.labelLarge, fontWeight: '700' },
  sectionSubtitle: { ...Typography.caption, marginTop: 2 },
  sectionBody:     { padding: Spacing[4], gap: Spacing[3] },
  dimmed:          { opacity: 0.4 },

  // Toggle row
  toggleRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  toggleLabel: { ...Typography.labelLarge },
  toggleDesc:  { ...Typography.caption, lineHeight: 16 },

  // Threshold input
  thresholdRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Spacing[3], borderTopWidth: StyleSheet.hairlineWidth,
  },
  thresholdInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1.5],
    minWidth: 80,
  },
  thresholdInput:  { ...Typography.labelLarge, minWidth: 50, textAlign: 'right' },
  thresholdSuffix: { ...Typography.labelLarge, marginLeft: 2 },

  divider: { height: StyleSheet.hairlineWidth },

  // Coming soon badge
  comingSoonBadge: { paddingHorizontal: Spacing[2], paddingVertical: Spacing[0.5], borderRadius: BorderRadius.full },
  comingSoonText:  { fontSize: 10, fontWeight: '800' },
  pushNote:        { ...Typography.caption, lineHeight: 18 },

  // Buttons
  secondaryBtn: {
    borderWidth: 1, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[3.5], alignItems: 'center',
  },
  secondaryBtnText: { ...Typography.labelLarge, fontWeight: '600' },
});
