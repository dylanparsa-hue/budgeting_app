/**
 * Manage Fixed Expenses
 *
 * Full-screen modal for viewing, adding, editing and deleting recurring bills.
 * Accessible from the dashboard "Upcoming Bills" card and the Plan tab.
 *
 * Features:
 *   – Grouped by category with icons and colours
 *   – Monthly equivalent shown for weekly/yearly items
 *   – Swipe-to-reveal delete (via press-and-hold confirm) or trash icon
 *   – Summary footer: total monthly obligations
 *   – "+ Add" FAB navigates to add-recurring modal
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Alert,
} from 'react-native';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { router }            from 'expo-router';
import { LinearGradient }    from 'expo-linear-gradient';

import { useRecurringStore }  from '../../src/stores/recurringStore';
import { useAuthStore }       from '../../src/stores/authStore';
import { RecurringExpense }   from '../../src/types';
import { useTheme }           from '../../src/theme/ThemeContext';
import { Typography }         from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency }     from '../../src/utils/currency';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toMonthly(amount: number, freq: string) {
  if (freq === 'weekly') return amount * 52 / 12;
  if (freq === 'yearly') return amount / 12;
  return amount;
}

const CAT_META: Record<string, { icon: string; color: string; label: string }> = {
  rent:         { icon: '🏠', color: '#6366F1', label: 'Rent / Mortgage'   },
  utilities:    { icon: '⚡', color: '#F59E0B', label: 'Utilities / Bills'  },
  subscription: { icon: '📱', color: '#8B5CF6', label: 'Subscriptions'     },
  debt:         { icon: '💳', color: '#EF4444', label: 'Debt / Loans'      },
  insurance:    { icon: '🛡️', color: '#3B82F6', label: 'Insurance'          },
  transport:    { icon: '🚗', color: '#10B981', label: 'Transport'          },
  other:        { icon: '📦', color: '#6B7280', label: 'Other'             },
};

const FREQ_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  weekly:  'Weekly',
  yearly:  'Yearly',
};

// ─────────────────────────────────────────────────────────────────────────────
// Row component
// ─────────────────────────────────────────────────────────────────────────────

function RecurringRow({
  item,
  currency,
  onEdit,
  onDelete,
}: {
  item:     RecurringExpense;
  currency: string;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const C      = useTheme();
  const meta   = CAT_META[item.category] ?? CAT_META.other;
  const monthly = toMonthly(item.amount, item.frequency);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const confirmDelete = () => {
    Alert.alert(
      'Delete bill',
      `Remove "${item.name}" from your recurring expenses?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => {
            Animated.timing(fadeAnim, {
              toValue: 0, duration: 200, useNativeDriver: true,
            }).start(onDelete);
          },
        },
      ],
    );
  };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={[S.row, { backgroundColor: C.surface }]}>
        {/* Coloured icon */}
        <View style={[S.rowIcon, { backgroundColor: meta.color + '18' }]}>
          <Text style={S.rowEmoji}>{meta.icon}</Text>
        </View>

        {/* Info */}
        <View style={S.rowInfo}>
          <Text style={[S.rowName, { color: C.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[S.rowMeta, { color: C.textTertiary }]}>
            {meta.label} · {FREQ_LABEL[item.frequency]}
          </Text>
        </View>

        {/* Amounts */}
        <View style={S.rowAmounts}>
          <Text style={[S.rowAmount, { color: C.textPrimary }]}>
            {formatCurrency(item.amount, currency)}
          </Text>
          {item.frequency !== 'monthly' && (
            <Text style={[S.rowMonthly, { color: C.textTertiary }]}>
              {formatCurrency(monthly, currency)}/mo
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={S.rowActions}>
          <TouchableOpacity
            onPress={onEdit}
            style={[S.actionBtn, { backgroundColor: C.primaryLight }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={S.actionEmoji}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmDelete}
            style={[S.actionBtn, { backgroundColor: C.dangerLight }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={S.actionEmoji}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ManageRecurringModal() {
  const C = useTheme();
  const { profile } = useAuthStore();
  const { items, loaded, load, remove } = useRecurringStore();
  const currency = profile?.currency ?? 'MYR';

  useEffect(() => { if (!loaded) load(); }, []);

  // ── Derived values ──────────────────────────────────────────────────────────
  const { billItems, billsTotal } = useMemo(() => {
    const billItems = [...items].sort((a, b) =>
      toMonthly(b.amount, b.frequency) - toMonthly(a.amount, a.frequency),
    );
    const billsTotal = billItems.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
    return { billItems, billsTotal };
  }, [items]);

  // Group by category for visual organisation
  const grouped = useMemo(() => {
    const map = new Map<string, RecurringExpense[]>();
    billItems.forEach(item => {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    });
    return Array.from(map.entries());
  }, [billItems]);

  const handleEdit = (item: RecurringExpense) => {
    router.push(`/modals/add-recurring?id=${item.id}` as any);
  };

  const handleDelete = (id: string) => {
    remove(id);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[S.safe, { backgroundColor: C.background }]} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[S.header, { borderBottomColor: C.divider }]}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/' as any)}
          style={[S.closeBtn, { backgroundColor: C.surfaceRaised }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[S.closeBtnText, { color: C.textSecondary }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: C.textPrimary }]}>Fixed Expenses</Text>
        <TouchableOpacity
          onPress={() => router.push('/modals/add-recurring' as any)}
          style={[S.addBtn, { backgroundColor: C.primary }]}
        >
          <Text style={S.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* ── Summary hero ──────────────────────────────────────────────────── */}
      {billsTotal > 0 && (
        <LinearGradient
          colors={['#EF4444', '#DC2626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.summaryHero}
        >
          <View style={S.summaryBg1} />
          <View style={S.summaryBg2} />
          <Text style={S.summaryLabel}>TOTAL MONTHLY OBLIGATIONS</Text>
          <Text style={S.summaryAmount}>{formatCurrency(billsTotal, currency)}</Text>
          <Text style={S.summarySubtitle}>{items.length} recurring expense{items.length !== 1 ? 's' : ''}</Text>
        </LinearGradient>
      )}

      {/* ── List ──────────────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <View style={S.emptyWrap}>
          <Text style={S.emptyIcon}>📋</Text>
          <Text style={[S.emptyTitle, { color: C.textPrimary }]}>No fixed expenses yet</Text>
          <Text style={[S.emptySub, { color: C.textTertiary }]}>
            Add rent, bills, subscriptions and loans so the app can calculate your true available balance.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/modals/add-recurring' as any)}
            style={[S.emptyBtn, { backgroundColor: C.primary }]}
          >
            <Text style={S.emptyBtnText}>Add first bill</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={S.list}
          showsVerticalScrollIndicator={false}
        >
          {grouped.map(([cat, catItems]) => {
            const meta      = CAT_META[cat] ?? CAT_META.other;
            const catTotal  = catItems.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
            return (
              <View key={cat} style={S.group}>
                {/* Group header */}
                <View style={S.groupHeader}>
                  <View style={[S.groupDot, { backgroundColor: meta.color }]} />
                  <Text style={[S.groupTitle, { color: C.textSecondary }]}>{meta.label}</Text>
                  <Text style={[S.groupTotal, { color: meta.color }]}>
                    {formatCurrency(catTotal, currency)}/mo
                  </Text>
                </View>

                {/* Items */}
                <View style={[S.groupCard, { backgroundColor: C.surface }]}>
                  {catItems.map((item, idx) => (
                    <View key={item.id}>
                      {idx > 0 && <View style={[S.hairline, { backgroundColor: C.divider }]} />}
                      <RecurringRow
                        item={item}
                        currency={currency}
                        onEdit={() => handleEdit(item)}
                        onDelete={() => handleDelete(item.id)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}

          {/* Bottom summary breakdown */}
          <View style={[S.breakdown, { backgroundColor: C.surface }]}>
            <Text style={[S.breakdownTitle, { color: C.textPrimary }]}>Monthly breakdown</Text>
            {grouped.map(([cat, catItems]) => {
              const meta     = CAT_META[cat] ?? CAT_META.other;
              const catTotal = catItems.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
              const pct      = billsTotal > 0 ? (catTotal / billsTotal) * 100 : 0;
              return (
                <View key={cat} style={S.breakdownRow}>
                  <Text style={S.breakdownEmoji}>{meta.icon}</Text>
                  <Text style={[S.breakdownLabel, { color: C.textSecondary }]} numberOfLines={1}>
                    {meta.label}
                  </Text>
                  <View style={[S.breakdownBarTrack, { backgroundColor: C.surfaceRaised }]}>
                    <View style={[S.breakdownBarFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                  </View>
                  <Text style={[S.breakdownPct, { color: meta.color }]}>{pct.toFixed(0)}%</Text>
                </View>
              );
            })}
            <View style={[S.breakdownDivider, { backgroundColor: C.divider }]} />
            <View style={S.breakdownRow}>
              <Text style={S.breakdownEmoji}>📊</Text>
              <Text style={[S.breakdownLabel, { color: C.textPrimary, fontWeight: '700' }]}>Total</Text>
              <View style={S.breakdownBarTrack} />
              <Text style={[S.breakdownPct, { color: C.danger, fontWeight: '800' }]}>
                {formatCurrency(billsTotal, currency)}
              </Text>
            </View>
          </View>

          <View style={{ height: Spacing[20] }} />
        </ScrollView>
      )}

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16 },
  headerTitle:  { ...Typography.titleMedium, flex: 1, textAlign: 'center' },
  addBtn:       { paddingHorizontal: Spacing[3.5], paddingVertical: Spacing[1.5], borderRadius: BorderRadius.full },
  addBtnText:   { ...Typography.labelLarge, color: '#fff' },

  // ── Hero summary ────────────────────────────────────────────────────────────
  summaryHero: {
    marginHorizontal: Spacing[5], marginTop: Spacing[4],
    borderRadius: BorderRadius['2xl'], padding: Spacing[5],
    overflow: 'hidden', gap: Spacing[0.5],
    ...Shadow.md,
  },
  summaryBg1: { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  summaryBg2: { position: 'absolute', bottom: -40, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' },
  summaryLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: 'rgba(255,255,255,0.65)' },
  summaryAmount:   { ...Typography.amount, color: '#fff', fontSize: 36, fontWeight: '800' },
  summarySubtitle: { ...Typography.caption, color: 'rgba(255,255,255,0.7)', marginTop: Spacing[0.5] },

  // ── List ────────────────────────────────────────────────────────────────────
  list: { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], gap: Spacing[4] },

  group:       { gap: Spacing[2] },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  groupDot:    { width: 8, height: 8, borderRadius: 4 },
  groupTitle:  { ...Typography.labelSmall, flex: 1 },
  groupTotal:  { ...Typography.caption, fontWeight: '700' },
  groupCard:   { borderRadius: BorderRadius['2xl'], overflow: 'hidden', ...Shadow.sm },
  hairline:    { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing[4] },

  // ── Row ─────────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3.5],
    gap: Spacing[3],
  },
  rowIcon:    { width: 42, height: 42, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowEmoji:   { fontSize: 20 },
  rowInfo:    { flex: 1, gap: 2 },
  rowName:    { ...Typography.labelLarge },
  rowMeta:    { ...Typography.caption },
  rowAmounts: { alignItems: 'flex-end', gap: 2 },
  rowAmount:  { ...Typography.labelLarge, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  rowMonthly: { ...Typography.caption, fontVariant: ['tabular-nums'] as any },
  rowActions: { flexDirection: 'row', gap: Spacing[1.5] },
  actionBtn:  { width: 30, height: 30, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  actionEmoji:{ fontSize: 13 },

  // ── Breakdown footer ────────────────────────────────────────────────────────
  breakdown: {
    borderRadius: BorderRadius['2xl'], padding: Spacing[5], gap: Spacing[3],
    ...Shadow.sm,
  },
  breakdownTitle:    { ...Typography.titleSmall, fontWeight: '700' },
  breakdownRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  breakdownEmoji:    { fontSize: 16, width: 22, textAlign: 'center' },
  breakdownLabel:    { ...Typography.caption, width: 110 },
  breakdownBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  breakdownBarFill:  { height: '100%', borderRadius: 3 },
  breakdownPct:      { ...Typography.caption, fontWeight: '700', width: 60, textAlign: 'right' },
  breakdownDivider:  { height: StyleSheet.hairlineWidth },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing[10], gap: Spacing[3],
  },
  emptyIcon:    { fontSize: 48 },
  emptyTitle:   { ...Typography.titleMedium, textAlign: 'center' },
  emptySub:     { ...Typography.bodySmall, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { marginTop: Spacing[2], paddingHorizontal: Spacing[6], paddingVertical: Spacing[3], borderRadius: BorderRadius.full },
  emptyBtnText: { ...Typography.labelLarge, color: '#fff', fontWeight: '700' },
});
