/**
 * Insights Screen — unified single-scroll page
 *
 * Layout (top → bottom inside one ScrollView):
 *   • Header (title + add button)
 *   • Search bar
 *   • Delete confirmation bar (conditional)
 *   • SpendingOverviewCard  — month selector, in/out toggle, SVG donut, category breakdown
 *   • Smart Insights section
 *   • Transaction list grouped by date (manually rendered — no SectionList nesting)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, G } from 'react-native-svg';
import { format, isToday, isYesterday } from 'date-fns';

import { useAuthStore }         from '../../src/stores/authStore';
import { useTransactionStore }  from '../../src/stores/transactionStore';
import { useRecurringStore }    from '../../src/stores/recurringStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { TransactionItem }      from '../../src/components/transactions/TransactionItem';
import { useTheme }             from '../../src/theme/ThemeContext';
import { Typography, FontFamily } from '../../src/theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../src/theme/spacing';
import { formatCurrency }       from '../../src/utils/currency';
import { INSIGHT_SEVERITY_ICON } from '../../src/lib/icons';
import { Transaction }          from '../../src/types';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartMode = 'out' | 'in';

// ─── SVG donut helpers ────────────────────────────────────────────────────────

const SVG_SIZE  = 220;
const SVG_CX    = SVG_SIZE / 2;
const SVG_CY    = SVG_SIZE / 2;
const SVG_R     = 80;
const STROKE_W  = 24;
// Center clear-zone inner radius = SVG_R - STROKE_W/2 = 68px → safe text width ≈ 110px

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  // Full circle special case
  if (endDeg - startDeg >= 359.9) {
    const p1 = polar(cx, cy, r, startDeg);
    const p2 = polar(cx, cy, r, startDeg + 180);
    return `M${p1.x},${p1.y} A${r},${r},0,1,1,${p2.x},${p2.y} A${r},${r},0,1,1,${p1.x},${p1.y}`;
  }
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${s.x},${s.y} A${r},${r},0,${large},1,${e.x},${e.y}`;
}

// ─── Palette for chart segments ───────────────────────────────────────────────

const PALETTE = [
  '#4ADE80', // green
  '#60A5FA', // blue
  '#F472B6', // pink
  '#FB923C', // orange
  '#A78BFA', // violet
  '#34D399', // emerald
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function groupByDate(
  txs: Transaction[],
  todayLabel: string,
  yesterdayLabel: string,
): { title: string; data: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>();
  txs.forEach(tx => {
    const d = new Date(tx.date);
    let key: string;
    if (isToday(d))          key = todayLabel;
    else if (isYesterday(d)) key = yesterdayLabel;
    else                     key = format(d, 'EEEE, MMM d');
    const group = groups.get(key) ?? [];
    group.push(tx);
    groups.set(key, group);
  });
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

// ─── SpendingOverviewCard sub-component ───────────────────────────────────────

interface ChartSegment {
  color:      string;
  startDeg:   number;
  endDeg:     number;
  label:      string;
  amount:     number;
  percentage: number;
}

interface OverviewCardProps {
  transactions: Transaction[];
  currency: string;
}

function SpendingOverviewCard({ transactions, currency }: OverviewCardProps) {
  const C = useTheme();
  const { t } = useTranslation();

  // Month / year state — capped at today
  const todayDate = new Date();
  const [selMonth, setSelMonth] = useState(todayDate.getMonth() + 1); // 1-12
  const [selYear,  setSelYear]  = useState(todayDate.getFullYear());
  const [chartMode, setChartMode] = useState<ChartMode>('out');

  const isCurrentMonth =
    selMonth === todayDate.getMonth() + 1 && selYear === todayDate.getFullYear();

  const goNext = () => {
    if (isCurrentMonth) return;
    if (selMonth === 12) { setSelMonth(1);  setSelYear(y => y + 1); }
    else                  setSelMonth(m => m + 1);
  };
  const goPrev = () => {
    if (selMonth === 1) { setSelMonth(12); setSelYear(y => y - 1); }
    else                 setSelMonth(m => m - 1);
  };

  const monthLabel = new Date(selYear, selMonth - 1, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });

  // Compute chart data
  const { total, segments, isEmpty } = useMemo(() => {
    const monthKey = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    const type = chartMode === 'out' ? 'expense' : 'income';
    const monthTxs = transactions.filter(
      tx => tx.type === type && tx.date.startsWith(monthKey),
    );
    const total = monthTxs.reduce((s, tx) => s + tx.amount, 0);

    if (total === 0) return { total: 0, segments: [], isEmpty: true };

    // Group by category
    const catMap = new Map<string, { label: string; color: string; amount: number }>();
    monthTxs.forEach(tx => {
      const key   = tx.category_id ?? 'other';
      const label = tx.category?.name ?? t('insights.other');
      const color = tx.category?.color ?? '#6B7280';
      const prev  = catMap.get(key);
      catMap.set(key, { label, color, amount: (prev?.amount ?? 0) + tx.amount });
    });

    // Sort desc, top 5 + "Other"
    const sorted = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount);
    let topItems = sorted.slice(0, 5);
    const rest   = sorted.slice(5);
    if (rest.length > 0) {
      topItems.push({
        label:  t('insights.other'),
        color:  '#6B7280',
        amount: rest.reduce((s, i) => s + i.amount, 0),
      });
    }

    // Build arc segments — no gap so segments connect seamlessly
    let cursor = 0;
    const segments: ChartSegment[] = topItems.map((item, idx) => {
      const pct      = item.amount / total;
      const sweep    = pct * 360;
      const startDeg = cursor;
      const endDeg   = cursor + sweep;
      cursor += sweep;
      return {
        color:      item.color && item.color !== '#6B7280' ? item.color : PALETTE[idx % PALETTE.length],
        startDeg,
        endDeg,
        label:      item.label,
        amount:     item.amount,
        percentage: pct * 100,
      };
    });

    return { total, segments, isEmpty: false };
  }, [transactions, selMonth, selYear, chartMode, t]);

  return (
    <View style={[overviewStyles.card, { backgroundColor: C.surface }, Shadow.sm]}>
      {/* Month selector */}
      <View style={overviewStyles.monthRow}>
        <TouchableOpacity onPress={goPrev} style={overviewStyles.arrowBtn}>
          <ChevronLeft size={20} color={C.textSecondary} strokeWidth={2.25} />
        </TouchableOpacity>
        <Text style={[overviewStyles.monthLabel, { color: C.textPrimary }]}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={goNext}
          style={[overviewStyles.arrowBtn, isCurrentMonth && { opacity: 0.3 }]}
          disabled={isCurrentMonth}
        >
          <ChevronRight size={20} color={C.textSecondary} strokeWidth={2.25} />
        </TouchableOpacity>
      </View>

      {/* Money In / Money Out toggle */}
      <View style={[overviewStyles.toggleRow, { backgroundColor: C.surfaceRaised }]}>
        {(['out', 'in'] as ChartMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            onPress={() => setChartMode(mode)}
            style={[
              overviewStyles.toggleBtn,
              chartMode === mode && { backgroundColor: C.primary },
            ]}
          >
            <Text style={[
              overviewStyles.toggleText,
              { color: chartMode === mode ? '#fff' : C.textSecondary },
            ]}>
              {mode === 'out' ? t('insights.moneyOut') : t('insights.moneyIn')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Donut chart */}
      <View style={overviewStyles.chartWrap}>
        <Svg width={SVG_SIZE} height={SVG_SIZE}>
          <G>
            {isEmpty ? (
              // Empty ring
              <Path
                d={arcPath(SVG_CX, SVG_CY, SVG_R, 0, 359.9)}
                fill="none"
                stroke={C.border}
                strokeWidth={STROKE_W}
                strokeLinecap="round"
              />
            ) : (
              segments.map((seg, i) => (
                <Path
                  key={i}
                  d={arcPath(SVG_CX, SVG_CY, SVG_R, seg.startDeg, seg.endDeg)}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={STROKE_W}
                  strokeLinecap="butt"
                />
              ))
            )}
          </G>
        </Svg>

        {/* Center label — constrained width so long amounts scale down */}
        <View style={overviewStyles.centerLabel} pointerEvents="none">
          <Text style={[overviewStyles.centerSub, { color: C.textTertiary }]}>
            {chartMode === 'out' ? t('insights.moneyOut') : t('insights.moneyIn')}
          </Text>
          <Text
            style={[overviewStyles.centerAmt, { color: C.textPrimary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatCurrency(total, currency)}
          </Text>
        </View>
      </View>

      {/* Category breakdown */}
      {isEmpty ? (
        <Text style={[overviewStyles.emptyNote, { color: C.textTertiary }]}>
          {chartMode === 'out' ? t('insights.noExpenses') : t('insights.noIncome')}
        </Text>
      ) : (
        <View style={overviewStyles.breakdownList}>
          {segments.map((seg, i) => (
            <View key={i} style={overviewStyles.breakdownRow}>
              <View style={[overviewStyles.dot, { backgroundColor: seg.color }]} />
              <Text style={[overviewStyles.breakdownLabel, { color: C.textPrimary }]} numberOfLines={1}>
                {seg.label}
              </Text>
              <Text style={[overviewStyles.breakdownPct, { color: C.textTertiary }]}>
                {seg.percentage.toFixed(0)}%
              </Text>
              <Text style={[overviewStyles.breakdownAmt, { color: C.textSecondary }]}>
                {formatCurrency(seg.amount, currency)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const overviewStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: FontFamily.display,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    // safe inner text width: (SVG_R - STROKE_W/2) * 2 * 0.85 ≈ 116px
    width: 116,
  },
  centerSub: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  centerAmt: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    width: '100%',
    textAlign: 'center',
  },
  emptyNote: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 8,
  },
  breakdownList: {
    gap: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  breakdownPct: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 34,
    textAlign: 'right',
  },
  breakdownAmt: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 70,
    textAlign: 'right',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const C = useTheme();
  const { t } = useTranslation();
  const { user, profile }                = useAuthStore();
  const { transactions, syncFromServer } = useTransactionStore();
  const removeTransaction                = useTransactionStore(s => s.removeTransaction);
  const { load: loadRecurring }          = useRecurringStore();
  const { insights }                     = useNotificationStore();

  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const currency = profile?.currency ?? 'MYR';

  useEffect(() => {
    if (user) syncFromServer(user.id);
    loadRecurring();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user) await syncFromServer(user.id);
    setRefreshing(false);
  };

  // ── Filtered transactions (search only — type filter removed with chips) ───

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(tx =>
      tx.note?.toLowerCase().includes(q) ||
      tx.category?.name.toLowerCase().includes(q),
    );
  }, [transactions, search]);

  const sections = useMemo(
    () => groupByDate(filtered, t('home.today'), t('home.yesterday')),
    [filtered, t],
  );

  const handleDelete = (tx: Transaction) => {
    removeTransaction(tx.id);
    setDeleteTarget(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: C.textPrimary }]}>{t('insights.title')}</Text>
        <TouchableOpacity
          onPress={() => router.push('/modals/add-transaction')}
          style={[styles.addBtn, { backgroundColor: C.primary }]}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* ── Single unified ScrollView ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: C.surfaceRaised }]}>
          <View style={{ paddingLeft: 14 }}>
            <Search size={16} color={C.textTertiary} strokeWidth={2.25} />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('insights.searchPlaceholder')}
            placeholderTextColor={C.textTertiary}
            style={[styles.searchInput, { color: C.textPrimary, textAlign: I18nManager.isRTL ? 'right' : 'left' }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ paddingRight: 14 }}>
              <X size={16} color={C.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Delete confirmation bar */}
        {deleteTarget && (
          <View style={[styles.deleteBar, { backgroundColor: C.dangerLight }]}>
            <Text style={[styles.deleteBarText, { color: C.danger }]} numberOfLines={1}>
              {t('insights.deleteConfirmTitle', { name: deleteTarget.category?.name ?? 'transaction' })}
            </Text>
            <View style={styles.deleteBarActions}>
              <TouchableOpacity onPress={() => setDeleteTarget(null)} style={styles.deleteBarBtn}>
                <Text style={[styles.deleteBarBtnText, { color: C.textSecondary }]}>{t('insights.deleteCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(deleteTarget)} style={styles.deleteBarBtn}>
                <Text style={[styles.deleteBarBtnText, { color: C.danger }]}>{t('insights.deleteConfirmBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Spending Overview Card ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitleLarge, { color: C.textPrimary }]}>
            {t('insights.spendingOverview')}
          </Text>
        </View>

        <SpendingOverviewCard transactions={transactions} currency={currency} />

        {/* ── Smart Insights ── */}
        {insights.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitleLarge, { color: C.textPrimary }]}>
                {t('insights.smartInsights')}
              </Text>
            </View>
            <View style={styles.insightsList}>
              {insights.slice(0, 4).map((insight, i) => {
                const SevIcon = INSIGHT_SEVERITY_ICON[insight.severity] ?? INSIGHT_SEVERITY_ICON.info;
                return (
                  <View key={i} style={[styles.insightCard, { backgroundColor: C.surface }, Shadow.sm]}>
                    <View style={[styles.insightIconBox, { backgroundColor: C.primaryLight }]}>
                      <SevIcon size={20} color={C.primary} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...Typography.titleSmall, color: C.textPrimary }}>
                        {insight.title}
                      </Text>
                      <Text style={{ ...Typography.bodySmall, color: C.textSecondary, marginTop: 2 }}>
                        {insight.message}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Transaction list header ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitleLarge, { color: C.textPrimary }]}>
            {t('insights.transactions')}
          </Text>
        </View>

        {/* ── Transaction list (manually rendered groups) ── */}
        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>
              {search ? t('insights.noResults') : t('insights.noTransactions')}
            </Text>
            <Text style={[styles.emptyText, { color: C.textTertiary }]}>
              {search
                ? t('insights.tryDifferent')
                : t('insights.tapToAdd')}
            </Text>
          </View>
        ) : (
          <View style={styles.txGroups}>
            {sections.map(section => (
              <View key={section.title}>
                {/* Section header */}
                <View style={[styles.groupHeader, { backgroundColor: C.background }]}>
                  <Text style={[styles.groupTitle, { color: C.textSecondary }]}>
                    {section.title}
                  </Text>
                  <Text style={[styles.groupCount, { color: C.textTertiary }]}>
                    {section.data.length}
                  </Text>
                </View>

                {/* Items */}
                <View style={[styles.groupCard, { backgroundColor: C.surface }, Shadow.sm]}>
                  {section.data.map((item, idx) => (
                    <View key={item.id}>
                      <TransactionItem
                        transaction={item}
                        currency={currency}
                        onPress={() => router.push(`/modals/add-transaction?id=${item.id}`)}
                        onDelete={() => setDeleteTarget(item)}
                      />
                      {idx < section.data.length - 1 && (
                        <View style={[styles.separator, { backgroundColor: C.divider }]} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    fontWeight: '800',
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '400', lineHeight: 26 },

  scrollContent: {
    paddingBottom: 24,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing[5],
    marginTop: Spacing[2],
    marginBottom: Spacing[3],
    borderRadius: BorderRadius.xl,
    height: 46,
    gap: Spacing[2],
  },
  searchInput: { flex: 1, ...Typography.bodyMedium },

  // Delete confirmation
  deleteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[2],
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2.5],
  },
  deleteBarText:    { ...Typography.bodySmall, flex: 1 },
  deleteBarActions: { flexDirection: 'row', gap: Spacing[4] },
  deleteBarBtn:     {},
  deleteBarBtnText: { ...Typography.labelSmall, fontWeight: '700' },

  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitleLarge: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    fontWeight: '700',
  },

  // Smart insights
  insightsList: { gap: 8, marginHorizontal: 16 },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  insightIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  // Transaction groups
  txGroups: {
    gap: 12,
    paddingHorizontal: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing[2],
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  groupTitle: { ...Typography.labelLarge },
  groupCount: { ...Typography.caption },
  groupCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  separator: { height: StyleSheet.hairlineWidth },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: Spacing[2],
  },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { ...Typography.titleSmall },
  emptyText:  { ...Typography.bodySmall, textAlign: 'center', paddingHorizontal: Spacing[10] },
});
