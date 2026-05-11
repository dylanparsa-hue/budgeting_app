import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Insight } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';

interface InsightCardProps {
  insight:  Insight;
  onPress?: () => void;
}

export function InsightCard({ insight, onPress }: InsightCardProps) {
  const C          = useTheme();
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(12)).current;

  const gradientMap: Record<Insight['type'], string[]> = {
    positive: C.gradients.primary,
    warning:  [C.warning, '#FB923C'],
    neutral:  C.gradients.dark,
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [insight.id]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Pressable onPress={onPress} style={({ pressed }) => pressed ? { opacity: 0.9 } : {}}>
        <LinearGradient
          colors={gradientMap[insight.type] as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, Shadow.xl]}
        >
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />
          <View style={styles.content}>
            <Text style={styles.icon}>{insight.icon}</Text>
            <View style={styles.textBlock}>
              <Text style={styles.title}>{insight.title}</Text>
              <Text style={styles.message}>{insight.message}</Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius:   BorderRadius['2xl'],
    padding:        Spacing[5],
    overflow:       'hidden',
    position:       'relative',
    minHeight:      110,
    justifyContent: 'center',
  },
  circleTopRight: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -40, left: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  content: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing[4], zIndex: 1,
  },
  icon:     { fontSize: 36 },
  textBlock: { flex: 1, gap: Spacing[1] },
  title:   { ...Typography.titleMedium, color: '#fff' },
  message: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.88)', lineHeight: 18 },
});
