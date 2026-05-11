import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface ProgressBarProps {
  progress:   number;
  color?:     string;
  height?:    number;
  showLabel?: boolean;
  animated?:  boolean;
  dangerAt?:  number;
  warningAt?: number;
}

export function ProgressBar({
  progress,
  color,
  height    = 8,
  showLabel = false,
  animated  = true,
  dangerAt  = 90,
  warningAt = 75,
}: ProgressBarProps) {
  const C        = useTheme();
  const clamped  = Math.min(Math.max(progress, 0), 100);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.spring(widthAnim, {
        toValue: clamped, useNativeDriver: false, tension: 60, friction: 10,
      }).start();
    } else {
      widthAnim.setValue(clamped);
    }
  }, [clamped]);

  const resolvedColor = color ?? (
    clamped >= dangerAt  ? C.danger  :
    clamped >= warningAt ? C.warning :
    C.primary
  );

  return (
    <View style={styles.wrapper}>
      <View style={[styles.track, { height, backgroundColor: C.borderLight }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              backgroundColor: resolvedColor,
              width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: resolvedColor }]}>
          {clamped.toFixed(0)}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  track:   { flex: 1, borderRadius: BorderRadius.full, overflow: 'hidden' },
  fill:    { borderRadius: BorderRadius.full },
  label:   { ...Typography.labelSmall, minWidth: 32, textAlign: 'right' },
});
