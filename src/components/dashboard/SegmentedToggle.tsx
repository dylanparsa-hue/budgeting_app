/**
 * SegmentedToggle
 *
 * Premium animated 3-tab financial toggle: Income · Spent · Saved
 *
 * Features:
 *   – Spring-animated sliding pill indicator (useNativeDriver: true)
 *   – Per-tab LinearGradient with matching colored glow
 *   – Glass-morphism container with subtle hairline border
 *   – Text + icon pairs, weight/color transition on active state
 *   – 60 fps via transform-only native animation
 */

import React, { useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }      from '../../theme/ThemeContext';
import { Typography }    from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardTab = 'income' | 'spent' | 'saved';

// ─────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────────────────────────────

const TABS: {
  key:      DashboardTab;
  label:    string;
  icon:     string;
  gradient: [string, string];
  glow:     string;
}[] = [
  { key: 'income', label: 'Income',  icon: '↑', gradient: ['#10B981', '#059669'], glow: '#10B981' },
  { key: 'spent',  label: 'Spent',   icon: '↓', gradient: ['#F87171', '#EF4444'], glow: '#EF4444' },
  { key: 'saved',  label: 'Saved',   icon: '★', gradient: ['#A78BFA', '#7C3AED'], glow: '#8B5CF6' },
];

const N_TABS    = TABS.length;
const INNER_PAD = 4;  // padding inside the pill container (each side)

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface SegmentedToggleProps {
  active:   DashboardTab;
  onChange: (tab: DashboardTab) => void;
}

export function SegmentedToggle({ active, onChange }: SegmentedToggleProps) {
  const C          = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  // Derive container width from screen so the indicator is sized before onLayout.
  // Scroll content has paddingHorizontal: Spacing[4] on each side.
  const containerW   = screenWidth - Spacing[4] * 2;
  const tabW         = (containerW - INNER_PAD * 2) / N_TABS;

  const activeIndex  = TABS.findIndex(t => t.key === active);
  const slideAnim    = useRef(new Animated.Value(activeIndex)).current;
  const activeTab    = TABS[activeIndex];

  // Indicator's translateX: position 0 = INNER_PAD from left edge
  const indicatorX = slideAnim.interpolate({
    inputRange:  [0, 1, 2],
    outputRange: [
      INNER_PAD,
      INNER_PAD + tabW,
      INNER_PAD + tabW * 2,
    ],
  });

  const handlePress = useCallback((idx: number) => {
    Animated.spring(slideAnim, {
      toValue:       idx,
      useNativeDriver: true,
      speed:         16,
      bounciness:    6,
    }).start();
    onChange(TABS[idx].key);
  }, [slideAnim, onChange]);

  return (
    <View
      style={[
        S.container,
        {
          backgroundColor: C.surfaceRaised,
          borderColor:     C.isDark
            ? 'rgba(255,255,255,0.07)'
            : 'rgba(0,0,0,0.05)',
        },
      ]}
    >
      {/* ── Sliding indicator ─────────────────────────────────────────────── */}
      <Animated.View
        style={[
          S.indicator,
          {
            width:         tabW,
            shadowColor:   activeTab.glow,
            shadowOffset:  { width: 0, height: 3 },
            shadowOpacity: 0.5,
            shadowRadius:  10,
            elevation:     5,
            transform:     [{ translateX: indicatorX }],
          },
        ]}
      >
        <LinearGradient
          colors={activeTab.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={S.indicatorGradient}
        />
        {/* Inner highlight stripe — top edge gloss */}
        <View style={S.indicatorGloss} />
      </Animated.View>

      {/* ── Tab buttons ───────────────────────────────────────────────────── */}
      {TABS.map((tab, idx) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => handlePress(idx)}
            style={S.tab}
            activeOpacity={0.75}
          >
            <View style={S.tabRow}>
              <Text
                style={[
                  S.tabIcon,
                  {
                    color:    isActive ? '#fff' : C.textTertiary,
                    opacity:  isActive ? 1 : 0.6,
                  },
                ]}
              >
                {tab.icon}
              </Text>
              <Text
                style={[
                  S.tabLabel,
                  {
                    color:      isActive ? '#fff' : C.textTertiary,
                    fontWeight: isActive ? '800' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius:  BorderRadius.full,
    padding:       INNER_PAD,
    borderWidth:   1,
    // Subtle lift shadow
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  8,
    elevation:     2,
  },

  // Sliding indicator — absolutely positioned behind tab labels
  indicator: {
    position:     'absolute',
    top:          INNER_PAD,
    bottom:       INNER_PAD,
    left:         0,                  // translateX handles horizontal position
    borderRadius: BorderRadius.full,
    overflow:     'hidden',
  },
  indicatorGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.full,
  },
  indicatorGloss: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          '40%',
    borderTopLeftRadius:  BorderRadius.full,
    borderTopRightRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  // Each tab occupies 1/3 of the container
  tab: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: Spacing[3],
    zIndex:          1,             // sits above indicator
  },
  tabRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing[1.5],
  },
  tabIcon: {
    fontSize:   13,
    fontWeight: '700',
    lineHeight: 16,
  },
  tabLabel: {
    ...Typography.caption,
    fontSize: 13,
    lineHeight: 16,
  },
});
