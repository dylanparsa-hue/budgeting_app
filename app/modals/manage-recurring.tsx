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
import { Pencil, Trash2, X, FileText, BarChart2 } from 'lucide-react-native';
import { BILL_META } from '../../src/lib/icons';
import { useTranslation } from 'react-i18next';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toMonthly(amount: number, freq: string) {
  if (freq === 'weekly') return amount * 52 / 12;
  if (freq === 'yearly') return amount / 12;
  return amount;
}

const CAT_KEY: Record<string, string> = {
  rent:         'addRecurring.catRent',
  utilities:    'addRecurring.catUtilities',
  subscription: 'addRecurring.catSubscription',
  debt:         'addRecurring.catDebt',
  insurance:    'addRecurring.catInsurance',
  transport:    'addRecurring.catTransport',
  other:        'addRecurring.catOther',
};

const FREQ_KEY: Record<string, string> = {
  monthly: 'addRecurring.monthly',
  weekly:  'addRecurring.weekly',
  yearly:  'addRecurring.yearly',
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
  const { t }  = useTranslation();
  const meta   = BILL_META[item.category] ?? BILL_META.other;
  const catLabel = t(CAT_KEY[item.category] ?? CAT_KEY.other);
  const RowIcon = meta.Icon;
  const monthly = toMonthly(item.amount, item.frequency);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const confirmDelete = () => {
    Alert.alert(
      t('manageRecurring.deleteBillTitle'),
      t('manageRecurring.deleteBillMsg', { name: item.name }),
      [
        { text: t('addRecurring.cancel'), style: 'cancel' },
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
          <RowIcon size={20} color={meta.color} strokeWidth={2} />
        </View>

        {/* Info */}
        <View style={S.rowInfo}>
          <Text style={[S.rowName, { color: C.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[S.rowMeta, { color: C.textTertiary }]}>
            {catLabel} · {t(FREQ_KEY[item.frequency] ?? FREQ_KEY.monthly)}
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
            <Pencil size={13} color={C.primary} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmDelete}
            style={[S.actionBtn, { backgroundColor: C.dangerLight }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Trash2 size={13} color={C.danger} strokeWidth={2.5} />
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
  const { t } = useTranslation();
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
          <X size={16} color={C.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: C.textPrimary }]}>{t('manageRecurring.title')}</Text>
        <TouchableOpacity
          onPress={() => router.push('/modals/add-recurring' as any)}
          style={[S.addBtn, { backgroundColor: C.primary }]}
        >
          <Text style={S.addBtnText}>{t('manageRecurring.addNew')}</Text>
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
          <Text style={S.summaryLabel}>{t('manageRecurring.totalLabel')}</Text>
          <Text style={S.summaryAmount}>{formatCurrency(billsTotal, currency)}</Text>
          <Text style={S.summarySubtitle}>{t('manageRecurring.recurringCount', { count: items.length })}</Text>
        </LinearGradient>
      )}

      {/* ── List ──────────────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <View style={S.emptyWrap}>
          <FileText size={48} color={C.textTertiary} strokeWidth={1.5} />
          <Text style={[S.emptyTitle, { color: C.textPrimary }]}>{t('manageRecurring.empty')}</Text>
          <Text style={[S.emptySub, { color: C.textTertiary }]}>{t('manageRecurring.emptySub')}</Text>
          <TouchableOpacity
            onPress={() => router.push('/modals/add-recurring' as any)}
            style={[S.emptyBtn, { backgroundColor: C.primary }]}
          >
            <Text style={S.emptyBtnText}>{t('manageRecurring.addFirstBill')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={S.list}
          showsVerticalScrollIndicator={false}
        >
          {grouped.map(([cat, catItems]) => {
            const meta      = BILL_META[cat] ?? BILL_META.other;
            const catLabel  = t(CAT_KEY[cat] ?? CAT_KEY.other);
            const catTotal  = catItems.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
            return (
              <View key={cat} style={S.group}>
                {/* Group header */}
                <View style={S.groupHeader}>
                  <View style={[S.groupDot, { backgroundColor: meta.color }]} />
                  <Text style={[S.groupTitle, { color: C.textSecondary }]}>{catLabel}</Text>
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
            <Text style={[S.breakdownTitle, { color: C.textPrimary }]}>{t('manageRecurring.monthlyBreakdown')}</Text>
            {grouped.map(([cat, catItems]) => {
              const meta     = BILL_META[cat] ?? BILL_META.other;
              const bLabel   = t(CAT_KEY[cat] ?? CAT_KEY.other);
              const BIcon    = meta.Icon;
              const catTotal = catItems.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
              const pct      = billsTotal > 0 ? (catTotal / billsTotal) * 100 : 0;
              return (
                <View key={cat} style={S.breakdownRow}>
                  <View style={S.breakdownIconWrap}>
                    <BIcon size={14} color={meta.color} strokeWidth={2} />
                  </View>
                  <Text style={[S.breakdownLabel, { color: C.textSecondary }]} numberOfLines={1}>
                    {bLabel}
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
              <View style={S.breakdownIconWrap}>
                <BarChart2 size={14} color={C.danger} strokeWidth={2} />
              </View>
              <Text style={[S.breakdownLabel, { color: C.textPrimary, fontWeight: '700' }]}>{t('finances.total')}</Text>
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
  breakdownIconWrap: { width: 22, alignItems: 'center' },
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
