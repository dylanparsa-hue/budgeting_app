/**
 * Smart Savings Planner — Full-screen modal
 *
 * Sections:
 *  1. Safety buffer selector  (15 / 20 / 25 %)
 *  2. Income flow breakdown   (Income → -Fixed → -Variable → -Buffer = Safe Savings)
 *  3. Per-goal plan cards     (status badge, monthly alloc, required monthly, projected)
 *  4. Income gap warning      (only when incomeGap > 0)
 *  5. Advice cards            (from buildAdvice)
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { router }          from 'expo-router';

import { useAuthStore }          from '../../src/stores/authStore';
import { useTransactionStore }   from '../../src/stores/transactionStore';
import { useRecurringStore }     from '../../src/stores/recurringStore';
import { useGoalStore }          from '../../src/stores/goalStore';
import { useAppSettingsStore }   from '../../src/stores/appSettingsStore';
import { generateSavingsPlan }   from '../../src/services/savingsPlanner';
import { GoalPlan }              from '../../src/services/savingsPlanner';
import { useTheme }            from '../../src/theme/ThemeContext';
import { Typography }          from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency }      from '../../src/utils/currency';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const BUFFER_OPTIONS = [
  { pct: 0.10, label: '10%', sublabel: 'Aggressive' },
  { pct: 0.15, label: '15%', sublabel: 'Moderate'   },
  { pct: 0.20, label: '20%', sublabel: 'Recommended' },
  { pct: 0.25, label: '25%', sublabel: 'Conservative' },
];

function statusConfig(status: GoalPlan['status']) {
  if (status === 'feasible')    return { emoji: '✅', label: 'On track',   bg: '#d1fae5', text: '#065f46' };
  if (status === 'risky')       return { emoji: '⚠️', label: 'At risk',    bg: '#fef3c7', text: '#92400e' };
  return                               { emoji: '❌', label: 'Not feasible', bg: '#fee2e2', text: '#991b1b' };
}

function adviceColors(line: string) {
  if (line.startsWith('🚨') || line.startsWith('❌')) return { bg: '#fee2e2', text: '#991b1b' };
  if (line.startsWith('⚠️'))                          return { bg: '#fef3c7', text: '#92400e' };
  if (line.startsWith('✅') || line.startsWith('🎯')) return { bg: '#d1fae5', text: '#065f46' };
  return null; // use default
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function SavingsPlannerModal() {
  const C = useTheme();
  const { profile }            = useAuthStore();
  const { transactions }       = useTransactionStore();
  const { items }              = useRecurringStore();
  const { goals }              = useGoalStore();
  const { trackingStartDate }  = useAppSettingsStore();

  const currency = profile?.currency ?? 'MYR';

  const [bufferPct, setBufferPct] = useState(0.20);

  const plan = useMemo(() => generateSavingsPlan({
    transactions,
    recurringItems:   items,
    goals,
    safetyBufferPct:  bufferPct,
    lookbackMonths:   3,
    trackingStartDate,
    currency,
  }), [transactions, items, goals, bufferPct, trackingStartDate, currency]);

  const hasGoals   = plan.goalPlans.length > 0;
  const hasGap     = plan.incomeGap > 0;
  const noIncome   = plan.monthlyIncome === 0;

  // Flow bar widths (fractions of income, clamped)
  const inc = plan.monthlyIncome || 1;
  const fixedFrac   = Math.min(plan.fixedExpenses   / inc, 1);
  const varFrac     = Math.min(plan.avgVariableExpenses / inc, 1);
  const bufferFrac  = Math.min(plan.safetyBufferAmount  / inc, 1);
  const saveFrac    = Math.max(plan.safeSavings / inc, 0);

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[S.header, { borderBottomColor: C.divider }]}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/plan' as any)}
          style={[S.closeBtn, { backgroundColor: C.surfaceRaised }]}
        >
          <Text style={[S.closeBtnText, { color: C.textSecondary }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: C.textPrimary }]}>Smart Savings Planner</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={S.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Safety buffer selector ─────────────────────────────────────── */}
        <View style={[S.card, Shadow.sm, { backgroundColor: C.surface }]}>
          <Text style={[S.cardTitle, { color: C.textPrimary }]}>Safety Buffer</Text>
          <Text style={[S.cardSub,   { color: C.textSecondary }]}>
            Reserve kept from disposable income before allocating to goals
          </Text>
          <View style={S.bufferRow}>
            {BUFFER_OPTIONS.map(o => {
              const active = bufferPct === o.pct;
              return (
                <TouchableOpacity
                  key={o.pct}
                  onPress={() => setBufferPct(o.pct)}
                  style={[
                    S.bufferBtn,
                    { backgroundColor: active ? C.primary : C.surfaceRaised },
                  ]}
                >
                  <Text style={[S.bufferPct,   { color: active ? '#fff' : C.textPrimary }]}>{o.label}</Text>
                  <Text style={[S.bufferLabel, { color: active ? 'rgba(255,255,255,0.75)' : C.textTertiary }]}>
                    {o.sublabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Income flow breakdown ──────────────────────────────────────── */}
        <View style={[S.card, Shadow.sm, { backgroundColor: C.surface }]}>
          <Text style={[S.cardTitle, { color: C.textPrimary }]}>Monthly Income Flow</Text>
          <Text style={[S.cardSub,   { color: C.textSecondary }]}>
            {plan.effectiveLookback}-month rolling average
            {trackingStartDate ? ' · adjusted for tracking start' : ''}
          </Text>

          {/* Stacked bar */}
          {!noIncome && (
            <View style={S.flowBar}>
              {fixedFrac  > 0 && <View style={[S.flowSegment, { flex: fixedFrac,  backgroundColor: '#ef4444' }]} />}
              {varFrac    > 0 && <View style={[S.flowSegment, { flex: varFrac,    backgroundColor: '#f59e0b' }]} />}
              {bufferFrac > 0 && <View style={[S.flowSegment, { flex: bufferFrac, backgroundColor: '#8b5cf6' }]} />}
              {saveFrac   > 0 && <View style={[S.flowSegment, { flex: saveFrac,   backgroundColor: '#10b981' }]} />}
            </View>
          )}

          {/* Flow rows */}
          <FlowRow
            label="Monthly Income"
            amount={plan.monthlyIncome}
            color={C.success}
            currency={currency}
            bold
          />
          <FlowRow
            label="Fixed Expenses"
            amount={plan.fixedExpenses}
            color="#ef4444"
            currency={currency}
            prefix="−"
          />
          <FlowRow
            label="Variable Spending"
            amount={plan.avgVariableExpenses}
            color="#f59e0b"
            currency={currency}
            prefix="−"
          />
          <View style={[S.flowDivider, { backgroundColor: C.divider }]} />
          <FlowRow
            label="Disposable Income"
            amount={plan.disposableIncome}
            color={plan.disposableIncome >= 0 ? C.textPrimary : '#ef4444'}
            currency={currency}
          />
          <FlowRow
            label={`Safety Buffer (${(bufferPct * 100).toFixed(0)}%)`}
            amount={plan.safetyBufferAmount}
            color="#8b5cf6"
            currency={currency}
            prefix="−"
          />
          <View style={[S.flowDivider, { backgroundColor: C.divider }]} />
          <FlowRow
            label="Safe to Save"
            amount={plan.safeSavings}
            color={plan.safeSavings > 0 ? C.primary : '#ef4444'}
            currency={currency}
            bold
          />

          {/* Legend */}
          {!noIncome && (
            <View style={S.flowLegend}>
              <LegendDot color="#ef4444" label="Fixed"    />
              <LegendDot color="#f59e0b" label="Variable" />
              <LegendDot color="#8b5cf6" label="Buffer"   />
              <LegendDot color="#10b981" label="Savings"  />
            </View>
          )}
        </View>

        {/* ── Goal plans ────────────────────────────────────────────────── */}
        {hasGoals && (
          <View style={S.section}>
            <Text style={[S.sectionTitle, { color: C.textPrimary }]}>Goal Plans</Text>
            <Text style={[S.sectionSub,   { color: C.textSecondary }]}>
              {formatCurrency(plan.safeSavings, currency)}/mo available · distributed by urgency
            </Text>

            {plan.goalPlans.map(gp => {
              const sc = statusConfig(gp.status);
              return (
                <View key={gp.goalId} style={[S.goalCard, Shadow.sm, { backgroundColor: C.surface }]}>
                  {/* Goal header */}
                  <View style={S.goalHeader}>
                    <View style={[S.goalIconBubble, { backgroundColor: gp.goalColor + '20' }]}>
                      <Text style={S.goalIcon}>{gp.goalIcon}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[S.goalName, { color: C.textPrimary }]} numberOfLines={1}>
                        {gp.goalName}
                      </Text>
                      <Text style={[S.goalProgress, { color: C.textTertiary }]}>
                        {formatCurrency(gp.currentAmount, currency)} of {formatCurrency(gp.targetAmount, currency)}
                      </Text>
                    </View>
                    <View style={[S.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[S.statusText, { color: sc.text }]}>{sc.emoji} {sc.label}</Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={[S.goalBarTrack, { backgroundColor: C.border }]}>
                    <View style={[
                      S.goalBarFill,
                      {
                        width: `${Math.min((gp.currentAmount / gp.targetAmount) * 100, 100)}%` as any,
                        backgroundColor: gp.goalColor,
                      },
                    ]} />
                  </View>

                  {/* Stats grid */}
                  <View style={S.goalStats}>
                    <GoalStat
                      label="Monthly Saving"
                      value={`${formatCurrency(gp.monthlySaving, currency)}/mo`}
                      highlight
                      color={C.primary}
                    />
                    {gp.requiredMonthly !== null && (
                      <GoalStat
                        label="Required/mo"
                        value={`${formatCurrency(gp.requiredMonthly, currency)}/mo`}
                        color={gp.shortfall > 0 ? '#ef4444' : C.textSecondary}
                      />
                    )}
                    {gp.monthsRemaining !== null && (
                      <GoalStat
                        label="Deadline in"
                        value={gp.monthsRemaining === 0 ? 'Overdue' : `${gp.monthsRemaining}mo`}
                        color={gp.monthsRemaining <= 1 ? '#ef4444' : C.textSecondary}
                      />
                    )}
                    {gp.projectedMonths !== null && (
                      <GoalStat
                        label="Projected"
                        value={`${gp.projectedMonths}mo`}
                        color={C.textSecondary}
                      />
                    )}
                  </View>

                  {/* Shortfall pill */}
                  {gp.shortfall > 0 && (
                    <View style={[S.shortfallPill, { backgroundColor: '#fee2e2' }]}>
                      <Text style={[S.shortfallText, { color: '#991b1b' }]}>
                        {formatCurrency(gp.shortfall, currency)}/mo short of target
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Allocation summary ─────────────────────────────────────────── */}
        {hasGoals && (
          <View style={[S.summaryRow, { backgroundColor: C.surface }, Shadow.sm]}>
            <SummaryItem
              label="Total needed/mo"
              value={formatCurrency(plan.totalRequiredSavings, currency)}
              color={C.textPrimary}
            />
            <View style={[S.summaryDivider, { backgroundColor: C.divider }]} />
            <SummaryItem
              label="Allocated/mo"
              value={formatCurrency(plan.totalAllocatedSavings, currency)}
              color={C.primary}
            />
            <View style={[S.summaryDivider, { backgroundColor: C.divider }]} />
            <SummaryItem
              label="Safe savings"
              value={formatCurrency(plan.safeSavings, currency)}
              color={plan.safeSavings >= plan.totalRequiredSavings ? C.success : '#ef4444'}
            />
          </View>
        )}

        {/* ── Income gap ─────────────────────────────────────────────────── */}
        {hasGap && (
          <View style={[S.gapCard, { backgroundColor: '#fee2e2' }]}>
            <Text style={S.gapEmoji}>💸</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.gapTitle, { color: '#991b1b' }]}>Income Gap Detected</Text>
              <Text style={[S.gapBody,  { color: '#b91c1c' }]}>
                You need an extra{' '}
                <Text style={{ fontWeight: '700' }}>{formatCurrency(plan.incomeGap, currency)}/mo</Text>
                {' '}to fund all deadline goals on time. Consider a side income or extending your deadlines.
              </Text>
            </View>
          </View>
        )}

        {/* ── No goals nudge ─────────────────────────────────────────────── */}
        {!hasGoals && plan.safeSavings > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/modals/add-goal')}
            style={[S.noGoalsCard, { backgroundColor: C.primaryLight, borderColor: C.primary + '40' }]}
          >
            <Text style={S.noGoalsIcon}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.noGoalsTitle, { color: C.primary }]}>
                {formatCurrency(plan.safeSavings, currency)}/mo ready to save
              </Text>
              <Text style={[S.noGoalsBody, { color: C.primary + 'bb' }]}>
                You have room to save but no goals set. Tap to create one →
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Advice cards ───────────────────────────────────────────────── */}
        {plan.advice.length > 0 && (
          <View style={S.section}>
            <Text style={[S.sectionTitle, { color: C.textPrimary }]}>Personalised Advice</Text>
            {plan.advice.map((line, i) => {
              const colors = adviceColors(line);
              const bg   = colors?.bg   ?? C.surface;
              const text = colors?.text ?? C.textPrimary;
              return (
                <View key={i} style={[S.adviceCard, Shadow.sm, { backgroundColor: bg }]}>
                  <Text style={[S.adviceText, { color: text }]}>{line}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: Spacing[10] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FlowRow({
  label, amount, color, currency, prefix, bold,
}: {
  label: string; amount: number; color: string;
  currency: string; prefix?: string; bold?: boolean;
}) {
  const C = useTheme();
  return (
    <View style={S.flowRow}>
      <Text style={[S.flowLabel, { color: C.textSecondary }, bold && { color: C.textPrimary, fontWeight: '600' }]}>
        {label}
      </Text>
      <Text style={[S.flowValue, { color }, bold && { fontSize: 17, fontWeight: '700' }]}>
        {prefix ?? ''}{formatCurrency(Math.abs(amount), currency)}
      </Text>
    </View>
  );
}

function GoalStat({ label, value, highlight, color }: {
  label: string; value: string; highlight?: boolean; color: string;
}) {
  const C = useTheme();
  return (
    <View style={S.goalStatItem}>
      <Text style={[S.goalStatLabel, { color: C.textTertiary }]}>{label}</Text>
      <Text style={[S.goalStatValue, { color }, highlight && { fontSize: 15, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  const C = useTheme();
  return (
    <View style={S.summaryItem}>
      <Text style={[S.summaryLabel, { color: C.textTertiary }]}>{label}</Text>
      <Text style={[S.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const C = useTheme();
  return (
    <View style={S.legendItem}>
      <View style={[S.legendDot, { backgroundColor: color }]} />
      <Text style={[S.legendLabel, { color: C.textTertiary }]}>{label}</Text>
    </View>
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

  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], gap: Spacing[4] },

  // Cards
  card: { borderRadius: BorderRadius.xl, padding: Spacing[5], gap: Spacing[3] },
  cardTitle: { ...Typography.titleSmall },
  cardSub:   { ...Typography.caption, marginTop: -Spacing[2] },

  // Buffer selector
  bufferRow: { flexDirection: 'row', gap: Spacing[2] },
  bufferBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing[2.5],
    borderRadius: BorderRadius.lg, gap: Spacing[0.5],
  },
  bufferPct:   { ...Typography.labelLarge },
  bufferLabel: { fontSize: 9, letterSpacing: 0.2 },

  // Flow breakdown
  flowBar: {
    flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: Spacing[1],
  },
  flowSegment: { borderRadius: 5 },
  flowRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing[1] },
  flowLabel:  { ...Typography.bodySmall },
  flowValue:  { ...Typography.labelLarge },
  flowDivider:{ height: 1, marginVertical: Spacing[1] },
  flowLegend: { flexDirection: 'row', gap: Spacing[4], flexWrap: 'wrap', marginTop: Spacing[1] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1.5] },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ ...Typography.caption },

  // Sections
  section:      { gap: Spacing[3] },
  sectionTitle: { ...Typography.titleSmall },
  sectionSub:   { ...Typography.caption, marginTop: -Spacing[2] },

  // Goal cards
  goalCard:    { borderRadius: BorderRadius.xl, padding: Spacing[4], gap: Spacing[3] },
  goalHeader:  { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  goalIconBubble: {
    width: 44, height: 44, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  goalIcon:     { fontSize: 22 },
  goalName:     { ...Typography.labelLarge },
  goalProgress: { ...Typography.caption },

  statusBadge: {
    paddingHorizontal: Spacing[2.5], paddingVertical: Spacing[1],
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 11, fontWeight: '600' },

  goalBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  goalBarFill:  { height: '100%', borderRadius: 3 },

  goalStats:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  goalStatItem: { minWidth: 90, gap: Spacing[0.5] },
  goalStatLabel:{ fontSize: 10, letterSpacing: 0.2 },
  goalStatValue:{ ...Typography.labelLarge },

  shortfallPill: {
    alignSelf: 'flex-start', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1],
  },
  shortfallText: { fontSize: 12, fontWeight: '600' },

  // Summary row
  summaryRow: {
    flexDirection: 'row', borderRadius: BorderRadius.xl,
    padding: Spacing[4], gap: Spacing[2],
  },
  summaryItem:    { flex: 1, alignItems: 'center', gap: Spacing[1] },
  summaryLabel:   { fontSize: 10, textAlign: 'center', letterSpacing: 0.2 },
  summaryValue:   { ...Typography.labelLarge, textAlign: 'center' },
  summaryDivider: { width: 1, alignSelf: 'stretch' },

  // Income gap
  gapCard: {
    flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start',
    borderRadius: BorderRadius.xl, padding: Spacing[4],
  },
  gapEmoji: { fontSize: 26 },
  gapTitle: { ...Typography.labelLarge, marginBottom: Spacing[1] },
  gapBody:  { ...Typography.bodySmall, lineHeight: 20 },

  // No goals
  noGoalsCard: {
    flexDirection: 'row', gap: Spacing[3], alignItems: 'center',
    borderRadius: BorderRadius.xl, padding: Spacing[4], borderWidth: 1,
  },
  noGoalsIcon:  { fontSize: 26 },
  noGoalsTitle: { ...Typography.labelLarge },
  noGoalsBody:  { ...Typography.caption, marginTop: Spacing[0.5] },

  // Advice
  adviceCard: { borderRadius: BorderRadius.xl, padding: Spacing[4] },
  adviceText: { ...Typography.bodySmall, lineHeight: 22 },
});
