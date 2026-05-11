import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { SmartInsight, InsightSeverity } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { useNotificationStore } from '../../stores/notificationStore';

// ── Colour mapping by severity ────────────────────────────────────────────────
function useSeverityColors(severity: InsightSeverity, C: any) {
  switch (severity) {
    case 'alert':   return { bg: C.dangerLight,  text: C.danger,   border: C.danger  + '40' };
    case 'warning': return { bg: '#FEF3C7',       text: '#D97706',  border: '#FCD34D' };
    case 'success': return { bg: C.successLight,  text: C.success,  border: C.success + '40' };
    default:        return { bg: C.surfaceRaised, text: C.primary,  border: C.primary + '30' };
  }
}

// ── Single insight card ───────────────────────────────────────────────────────
function InsightItem({ insight }: { insight: SmartInsight }) {
  const C      = useTheme();
  const colors = useSeverityColors(insight.severity, C);
  const dismiss = useNotificationStore(s => s.dismiss);
  const slideX  = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideX,  { toValue: 60, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,  duration: 200, useNativeDriver: true }),
    ]).start(() => dismiss(insight.id));
  };

  const handleAction = () => {
    if (insight.actionRoute) router.push(insight.actionRoute as any);
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateX: slideX }] }}>
      <Pressable
        onPress={insight.actionRoute ? handleAction : undefined}
        style={[
          styles.card,
          {
            backgroundColor: colors.bg,
            borderColor:     colors.border,
          },
        ]}
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{insight.icon}</Text>
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {insight.title}
          </Text>
          <Text style={[styles.message, { color: C.textSecondary }]} numberOfLines={2}>
            {insight.message}
          </Text>
          {insight.actionLabel && (
            <TouchableOpacity onPress={handleAction} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                {insight.actionLabel} →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dismiss */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.dismissBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.dismissText, { color: C.textTertiary }]}>✕</Text>
        </TouchableOpacity>
      </Pressable>
    </Animated.View>
  );
}

// ── Feed ──────────────────────────────────────────────────────────────────────
interface InsightsFeedProps {
  insights:     SmartInsight[];
  maxVisible?:  number;
  showAll?:     boolean;
}

export function InsightsFeed({ insights, maxVisible = 3, showAll = false }: InsightsFeedProps) {
  const C = useTheme();
  const [expanded, setExpanded] = React.useState(false);

  if (insights.length === 0) return null;

  const visible = showAll || expanded ? insights : insights.slice(0, maxVisible);
  const hidden  = insights.length - maxVisible;

  return (
    <View style={styles.feed}>
      <View style={styles.feedHeader}>
        <View style={styles.feedTitleRow}>
          <Text style={[styles.feedTitle, { color: C.textPrimary }]}>Smart Insights</Text>
          <View style={[styles.badge, { backgroundColor: C.primary + '20' }]}>
            <Text style={[styles.badgeText, { color: C.primary }]}>{insights.length}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/modals/notification-settings' as any)}>
          <Text style={[styles.settingsLink, { color: C.primary }]}>⚙ Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: Spacing[2] }}>
        {visible.map(ins => <InsightItem key={ins.id} insight={ins} />)}
      </View>

      {!expanded && hidden > 0 && (
        <TouchableOpacity onPress={() => setExpanded(true)} style={styles.showMoreBtn}>
          <Text style={[styles.showMoreText, { color: C.primary }]}>
            Show {hidden} more insight{hidden > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Compact single-card version (replaces old InsightCard) ───────────────────
export function PrimaryInsightCard({ insight }: { insight: SmartInsight }) {
  const C      = useTheme();
  const colors = useSeverityColors(insight.severity, C);
  const dismiss = useNotificationStore(s => s.dismiss);

  const gradients: Record<InsightSeverity, string[]> = {
    success: ['#10B981', '#059669'],
    info:    ['#3B82F6', '#2563EB'],
    warning: ['#F59E0B', '#D97706'],
    alert:   ['#EF4444', '#DC2626'],
  };

  return (
    <View style={[styles.primaryCard, { backgroundColor: gradients[insight.severity]?.[0] ?? C.primary, overflow: 'hidden' }]}>
      <View style={styles.primaryCircle1} />
      <View style={styles.primaryCircle2} />
      <View style={styles.primaryContent}>
        <Text style={styles.primaryIcon}>{insight.icon}</Text>
        <View style={{ flex: 1, gap: Spacing[0.5] }}>
          <Text style={styles.primaryTitle}>{insight.title}</Text>
          <Text style={styles.primaryMsg}>{insight.message}</Text>
          {insight.actionLabel && (
            <TouchableOpacity onPress={() => insight.actionRoute && router.push(insight.actionRoute as any)}>
              <Text style={styles.primaryAction}>{insight.actionLabel} →</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => dismiss(insight.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  feed:        { gap: Spacing[3] },
  feedHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feedTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  feedTitle:   { ...Typography.titleSmall },
  badge:       { paddingHorizontal: Spacing[2], paddingVertical: 2, borderRadius: BorderRadius.full },
  badgeText:   { fontSize: 11, fontWeight: '800' },
  settingsLink:{ ...Typography.caption },

  // Insight card
  card: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            Spacing[3],
    borderRadius:   BorderRadius.xl,
    padding:        Spacing[3.5],
    borderWidth:    1,
    ...Shadow.sm,
  },
  iconWrap:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  icon:        { fontSize: 22 },
  textWrap:    { flex: 1, gap: Spacing[0.5] },
  title:       { ...Typography.labelLarge, fontWeight: '700' },
  message:     { ...Typography.caption, lineHeight: 17 },
  actionLabel: { ...Typography.caption, fontWeight: '700', marginTop: Spacing[1] },
  dismissBtn:  { padding: Spacing[0.5] },
  dismissText: { fontSize: 13 },

  showMoreBtn:  { alignItems: 'center', paddingVertical: Spacing[1.5] },
  showMoreText: { ...Typography.caption, fontWeight: '700' },

  // Primary card
  primaryCard: {
    borderRadius:   BorderRadius['2xl'],
    padding:        Spacing[5],
    position:       'relative',
    ...Shadow.md,
  },
  primaryCircle1: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  primaryCircle2: {
    position: 'absolute', bottom: -40, left: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  primaryContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4], zIndex: 1 },
  primaryIcon:    { fontSize: 36 },
  primaryTitle:   { ...Typography.titleSmall, color: '#fff', fontWeight: '700' },
  primaryMsg:     { ...Typography.caption, color: 'rgba(255,255,255,0.88)', lineHeight: 17 },
  primaryAction:  { ...Typography.caption, color: 'rgba(255,255,255,0.75)', fontWeight: '700', marginTop: Spacing[1.5] },
});
