/**
 * FinancialChart
 *
 * Animated SVG line chart showing income, expenses, and net balance.
 * Time ranges: 1W · 1M · 6M (default) · 1Y
 * Features:
 *   – Smooth Catmull-Rom bezier curves
 *   – Gradient area fills per series
 *   – Tap-to-inspect tooltip on any data point
 *   – Crossfade animation when switching ranges
 *   – Series toggle via legend press
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Pressable, Animated, LayoutChangeEvent,
} from 'react-native';
import Svg, {
  Path, Circle, Defs,
  LinearGradient as SvgGradient,
  Stop, Line as SvgLine,
  Text as SvgText,
} from 'react-native-svg';
import {
  format, subDays, subMonths, subWeeks,
  startOfWeek, endOfWeek, isWithinInterval,
} from 'date-fns';

import type { Transaction, RecurringExpense } from '../../types';
import { useTheme }    from '../../theme/ThemeContext';
import { Typography }  from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currency';
import { TrendingUp } from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TimeRange = '1W' | '1M' | '6M' | '1Y';
type SeriesKey = 'income' | 'expenses' | 'net';

interface DataPoint {
  label:     string;   // short X-axis label
  fullLabel: string;   // tooltip label
  income:    number;
  expenses:  number;
  net:       number;
}

interface SeriesMeta {
  key:   SeriesKey;
  label: string;
  color: string;
  gradId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart geometry
// ─────────────────────────────────────────────────────────────────────────────

const CHART_H  = 160;   // SVG canvas height
const PAD_LEFT = 42;    // room for Y-axis labels
const PAD_RIGHT = 14;
const PAD_TOP   = 14;
const PAD_BOT   = 10;

/** Map values → SVG coordinate objects */
function toPoints(
  values: number[],
  minV: number,
  maxV: number,
  svgW: number,
): { x: number; y: number }[] {
  const range = maxV - minV || 1;
  const drawH = CHART_H - PAD_TOP - PAD_BOT;
  const drawW = svgW - PAD_LEFT - PAD_RIGHT;
  const n     = values.length;
  const step  = n > 1 ? drawW / (n - 1) : 0;
  return values.map((v, i) => ({
    x: PAD_LEFT + i * step,
    y: PAD_TOP  + drawH - ((v - minV) / range) * drawH,
  }));
}

/** Catmull-Rom → Cubic Bézier smooth path */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const t = 0.32; // tension — lower = less curvy
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(i - 2, 0)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(i + 1, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${f(cp1x)},${f(cp1y)} ${f(cp2x)},${f(cp2y)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}

/** Area fill = smoothPath + close to bottom baseline */
function areaPath(pts: { x: number; y: number }[], baseY: number): string {
  if (pts.length < 2) return '';
  return `${smoothPath(pts)} L ${f(pts[pts.length - 1].x)} ${f(baseY)} L ${f(pts[0].x)} ${f(baseY)} Z`;
}

const f = (n: number) => n.toFixed(1);

// ─────────────────────────────────────────────────────────────────────────────
// Data builders
// ─────────────────────────────────────────────────────────────────────────────

function buildData(
  transactions: Transaction[],
  range: TimeRange,
): DataPoint[] {
  const now = new Date();

  const incomeIn   = (arr: Transaction[]) => arr.filter(t => t.type === 'income' ).reduce((s, t) => s + Number(t.amount), 0);
  const expensesIn = (arr: Transaction[]) => arr.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const inRange    = (t: Transaction, start: Date, end: Date) =>
    isWithinInterval(new Date(t.date), { start, end });

  if (range === '1W') {
    return Array.from({ length: 7 }, (_, i) => {
      const d     = subDays(now, 6 - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      const slice = transactions.filter(t => inRange(t, start, end));
      const inc = incomeIn(slice);
      const exp = expensesIn(slice);
      return {
        label:     format(d, 'EEE'),
        fullLabel: format(d, 'EEE, MMM d'),
        income:   inc,
        expenses: exp,
        net:      inc - exp,
      };
    });
  }

  if (range === '1M') {
    return Array.from({ length: 5 }, (_, i) => {
      const anchor = subWeeks(now, 4 - i);
      const start  = startOfWeek(anchor, { weekStartsOn: 1 });
      const end    = endOfWeek(anchor,   { weekStartsOn: 1 });
      const slice  = transactions.filter(t => inRange(t, start, end));
      const inc = incomeIn(slice);
      const exp = expensesIn(slice);
      return {
        label:     `W${i + 1}`,
        fullLabel: `Week of ${format(start, 'MMM d')}`,
        income:   inc,
        expenses: exp,
        net:      inc - exp,
      };
    });
  }

  if (range === '6M') {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const slice = transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() + 1 === m && td.getFullYear() === y;
      });
      const inc = incomeIn(slice);
      const exp = expensesIn(slice);
      return {
        label:     format(d, 'MMM'),
        fullLabel: format(d, 'MMMM yyyy'),
        income:   inc,
        expenses: exp,
        net:      inc - exp,
      };
    });
  }

  // 1Y — 12 monthly buckets
  return Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const slice = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getMonth() + 1 === m && td.getFullYear() === y;
    });
    const inc = incomeIn(slice);
    const exp = expensesIn(slice);
    return {
      label:     format(d, 'MMM'),
      fullLabel: format(d, 'MMM yyyy'),
      income:   inc,
      expenses: exp,
      net:      inc - exp,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact Y-axis formatter
// ─────────────────────────────────────────────────────────────────────────────

function compactNum(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return v.toFixed(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Series config
// ─────────────────────────────────────────────────────────────────────────────

const SERIES: SeriesMeta[] = [
  { key: 'income',   label: 'Income',        color: '#10B981', gradId: 'incGrad'  },
  { key: 'expenses', label: 'Expenses+Bills', color: '#F87171', gradId: 'expGrad'  },
  { key: 'net',      label: 'Net',            color: '#818CF8', gradId: 'netGrad'  },
];

const RANGE_OPTS: { key: TimeRange; label: string }[] = [
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface FinancialChartProps {
  transactions: Transaction[];
  recurring:    RecurringExpense[];
  currency:     string;
}

export function FinancialChart({ transactions, recurring, currency }: FinancialChartProps) {
  const C = useTheme();

  const [range,     setRange]     = useState<TimeRange>('6M');
  const [svgW,      setSvgW]      = useState(300);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [hidden,    setHidden]    = useState<Set<SeriesKey>>(new Set());

  const fadeAnim     = useRef(new Animated.Value(1)).current;
  const pendingRange = useRef<TimeRange>('6M');

  // ── Build data ─────────────────────────────────────────────────────────────
  const data = useMemo(
    () => buildData(transactions, range),
    [transactions, range],
  );

  const allZero = data.every(d => d.income === 0 && d.expenses === 0 && d.net === 0);

  // ── Y extents ──────────────────────────────────────────────────────────────
  const { minV, maxV } = useMemo(() => {
    const all: number[] = [];
    SERIES.forEach(s => {
      if (!hidden.has(s.key)) all.push(...data.map(d => d[s.key]));
    });
    if (all.length === 0) return { minV: 0, maxV: 100 };
    const rawMin = Math.min(...all);
    const rawMax = Math.max(...all);
    const pad    = (rawMax - rawMin) * 0.12 || 50;
    return { minV: rawMin - pad, maxV: rawMax + pad };
  }, [data, hidden]);

  // ── Active summary values ──────────────────────────────────────────────────
  const summaryPoint = activeIdx !== null ? data[activeIdx] : data[data.length - 1];

  // ── SVG path memos ────────────────────────────────────────────────────────
  const baseY = PAD_TOP + (CHART_H - PAD_TOP - PAD_BOT);
  const paths = useMemo(() => {
    return SERIES.map(s => {
      if (hidden.has(s.key)) return { s, pts: [], line: '', area: '' };
      const vals = data.map(d => d[s.key]);
      const pts  = toPoints(vals, minV, maxV, svgW);
      return { s, pts, line: smoothPath(pts), area: areaPath(pts, baseY) };
    });
  }, [data, minV, maxV, svgW, hidden]);

  // Active point vertical x
  const activeX = useMemo(() => {
    if (activeIdx === null || data.length < 2) return null;
    const drawW = svgW - PAD_LEFT - PAD_RIGHT;
    return PAD_LEFT + (activeIdx / (data.length - 1)) * drawW;
  }, [activeIdx, data.length, svgW]);

  // Y-axis grid values
  const gridValues = useMemo(() => {
    const drawH = CHART_H - PAD_TOP - PAD_BOT;
    const range = maxV - minV || 1;
    return [0, 0.33, 0.67, 1].map(frac => {
      const value = minV + frac * range;
      const y     = PAD_TOP + drawH - frac * drawH;
      return { value, y };
    });
  }, [minV, maxV]);

  // ── Range switch with crossfade ────────────────────────────────────────────
  const switchRange = useCallback((r: TimeRange) => {
    if (r === range) return;
    pendingRange.current = r;
    setActiveIdx(null);
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 120, useNativeDriver: true,
    }).start(() => {
      setRange(pendingRange.current);
      Animated.spring(fadeAnim, {
        toValue: 1, useNativeDriver: true, speed: 22, bounciness: 2,
      }).start();
    });
  }, [range, fadeAnim]);

  const toggleSeries = useCallback((key: SeriesKey) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setActiveIdx(null);
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setSvgW(Math.floor(e.nativeEvent.layout.width));
  }, []);

  const handleChartPress = useCallback((e: any) => {
    const lx = e?.nativeEvent?.locationX ?? 0;
    if (data.length < 2) return;
    const drawW = svgW - PAD_LEFT - PAD_RIGHT;
    const step  = drawW / (data.length - 1);
    const idx   = Math.round((lx - PAD_LEFT) / step);
    setActiveIdx(Math.max(0, Math.min(idx, data.length - 1)));
  }, [data.length, svgW]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[S.card, { backgroundColor: C.surface }]}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={S.headerRow}>
        <View>
          <Text style={[S.cardTitle, { color: C.textPrimary }]}>Financial Overview</Text>
          <Text style={[S.subtitle, { color: C.textTertiary }]}>
            {summaryPoint.fullLabel}
          </Text>
        </View>

        {/* Range tabs */}
        <View style={[S.rangeTabs, { backgroundColor: C.surfaceRaised ?? C.border + '30' }]}>
          {RANGE_OPTS.map(opt => {
            const active = opt.key === range;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => switchRange(opt.key)}
                style={[
                  S.rangeTab,
                  active && [S.rangeTabActive, { backgroundColor: C.primary }],
                ]}
                activeOpacity={0.7}
              >
                <Text style={[
                  S.rangeTabText,
                  { color: active ? '#fff' : C.textTertiary },
                  active && S.rangeTabTextActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      <View style={S.summaryRow}>
        {SERIES.map(s => (
          <StatPill
            key={s.key}
            label={s.label}
            value={summaryPoint[s.key]}
            color={s.color}
            currency={currency}
            dim={hidden.has(s.key)}
          />
        ))}
      </View>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      <Animated.View
        onLayout={onLayout}
        style={[S.chartWrap, { opacity: fadeAnim }]}
      >
        {allZero ? (
          <View style={S.noData}>
            <TrendingUp size={32} color={C.textTertiary} strokeWidth={1.5} />
            <Text style={[S.noDataText, { color: C.textTertiary }]}>
              Add transactions to see trends
            </Text>
          </View>
        ) : (
          <>
            <Svg width={svgW} height={CHART_H}>
              <Defs>
                {SERIES.map(s => (
                  <SvgGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0"   stopColor={s.color} stopOpacity="0.22" />
                    <Stop offset="0.7" stopColor={s.color} stopOpacity="0.04" />
                    <Stop offset="1"   stopColor={s.color} stopOpacity="0"   />
                  </SvgGradient>
                ))}
              </Defs>

              {/* ── Horizontal gridlines ─────────────────────────────────── */}
              {gridValues.map((g, i) => (
                <SvgLine
                  key={i}
                  x1={PAD_LEFT} y1={f(g.y)}
                  x2={svgW - PAD_RIGHT} y2={f(g.y)}
                  stroke={C.divider ?? '#E5E7EB'}
                  strokeWidth={0.6}
                  strokeDasharray={i === 0 ? undefined : '4,4'}
                />
              ))}

              {/* ── Zero line (if net can go negative) ───────────────────── */}
              {minV < 0 && (() => {
                const drawH  = CHART_H - PAD_TOP - PAD_BOT;
                const zeroY  = PAD_TOP + drawH - ((0 - minV) / (maxV - minV)) * drawH;
                return (
                  <SvgLine
                    x1={PAD_LEFT} y1={f(zeroY)}
                    x2={svgW - PAD_RIGHT} y2={f(zeroY)}
                    stroke={C.textTertiary ?? '#9CA3AF'}
                    strokeWidth={0.8}
                    strokeDasharray="6,3"
                  />
                );
              })()}

              {/* ── Area fills ───────────────────────────────────────────── */}
              {paths.map(({ s, area }) =>
                area ? (
                  <Path
                    key={`area-${s.key}`}
                    d={area}
                    fill={`url(#${s.gradId})`}
                  />
                ) : null
              )}

              {/* ── Lines ────────────────────────────────────────────────── */}
              {paths.map(({ s, line }) =>
                line ? (
                  <Path
                    key={`line-${s.key}`}
                    d={line}
                    stroke={s.color}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null
              )}

              {/* ── Active vertical line ──────────────────────────────────── */}
              {activeX !== null && (
                <SvgLine
                  x1={f(activeX)} y1={f(PAD_TOP)}
                  x2={f(activeX)} y2={f(baseY)}
                  stroke={C.textTertiary ?? '#9CA3AF'}
                  strokeWidth={1}
                  strokeDasharray="4,3"
                />
              )}

              {/* ── Dots at all data points ───────────────────────────────── */}
              {paths.map(({ s, pts }) =>
                pts.map((pt, i) => {
                  const isActive = i === activeIdx;
                  return (
                    <Circle
                      key={`dot-${s.key}-${i}`}
                      cx={f(pt.x)}
                      cy={f(pt.y)}
                      r={isActive ? 5 : 3}
                      fill={isActive ? s.color : C.surface}
                      stroke={s.color}
                      strokeWidth={isActive ? 2 : 1.5}
                    />
                  );
                })
              )}

              {/* ── Y-axis value labels ───────────────────────────────────── */}
              {gridValues.map((g, i) => (
                <SvgText
                  key={`ylabel-${i}`}
                  x={PAD_LEFT - 6}
                  y={g.y + 4}
                  textAnchor="end"
                  fontSize={9}
                  fontWeight="500"
                  fill={C.textTertiary ?? '#9CA3AF'}
                >
                  {compactNum(g.value)}
                </SvgText>
              ))}
            </Svg>

            {/* Tap overlay */}
            <Pressable style={StyleSheet.absoluteFill} onPress={handleChartPress} />

            {/* ── X-axis labels ────────────────────────────────────────────── */}
            <View style={[S.xAxis, { paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT }]}>
              {data.map((d, i) => (
                <Text
                  key={i}
                  style={[
                    S.xLabel,
                    {
                      color: i === activeIdx ? C.textPrimary : C.textTertiary,
                      fontWeight: i === activeIdx ? '700' : '400',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {d.label}
                </Text>
              ))}
            </View>
          </>
        )}
      </Animated.View>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <View style={S.legend}>
        {SERIES.map(s => (
          <TouchableOpacity
            key={s.key}
            onPress={() => toggleSeries(s.key)}
            style={S.legendItem}
            activeOpacity={0.65}
          >
            <View style={[
              S.legendLine,
              {
                backgroundColor: s.color,
                opacity: hidden.has(s.key) ? 0.25 : 1,
              },
            ]} />
            <Text style={[
              S.legendLabel,
              { color: hidden.has(s.key) ? C.textTertiary : C.textSecondary },
            ]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatPill
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({
  label, value, color, currency, dim,
}: {
  label: string; value: number; color: string; currency: string; dim: boolean;
}) {
  const C = useTheme();
  return (
    <View style={[S.statPill, { backgroundColor: color + '14', opacity: dim ? 0.35 : 1 }]}>
      <View style={[S.statDot, { backgroundColor: color }]} />
      <View style={{ gap: 1 }}>
        <Text style={[S.statLabel, { color: C.textTertiary }]}>{label}</Text>
        <Text style={[S.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
          {value >= 0 ? '' : '−'}{formatCurrency(Math.abs(value), currency, { compact: true })}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  card: {
    borderRadius: BorderRadius['2xl'],
    padding:      Spacing[5],
    gap:          Spacing[4],
    ...Shadow.sm,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            Spacing[3],
  },
  cardTitle: { ...Typography.titleSmall, fontWeight: '700' },
  subtitle:  { ...Typography.caption, marginTop: 2 },

  // Range tabs
  rangeTabs: {
    flexDirection: 'row',
    borderRadius:  BorderRadius.lg,
    padding:       3,
    gap:           2,
  },
  rangeTab: {
    paddingHorizontal: Spacing[2.5],
    paddingVertical:   Spacing[1],
    borderRadius:      BorderRadius.md,
    alignItems:        'center',
    justifyContent:    'center',
    minWidth:          32,
  },
  rangeTabActive: {
    ...Shadow.sm,
  },
  rangeTabText: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize:   11,
  },
  rangeTabTextActive: {
    fontWeight: '700',
  },

  // Summary stats row
  summaryRow: {
    flexDirection: 'row',
    gap:           Spacing[2],
  },
  statPill: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing[1.5],
    borderRadius:   BorderRadius.lg,
    paddingVertical: Spacing[2.5],
    paddingHorizontal: Spacing[2.5],
    minWidth: 0,
  },
  statDot:   { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  statLabel: { ...Typography.caption, fontSize: 10 },
  statValue: { ...Typography.caption, fontWeight: '700', fontSize: 12, fontVariant: ['tabular-nums'] as any },

  // Chart
  chartWrap: { gap: Spacing[1] },
  noData: {
    height: CHART_H + 24,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing[2],
  },
  noDataText: { ...Typography.caption },

  // X-axis
  xAxis: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      Spacing[1],
  },
  xLabel: { ...Typography.caption, fontSize: 10, textAlign: 'center' },

  // Legend
  legend: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            Spacing[5],
    paddingTop:     Spacing[1],
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1.5] },
  legendLine: { width: 16, height: 2.5, borderRadius: 2 },
  legendLabel:{ ...Typography.caption, fontWeight: '500' },
});
