import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
  label:    string;
  variant?: BadgeVariant;
  style?:   ViewStyle;
}

const variantMap: Record<BadgeVariant, { bg: string; text: string }> = {
  default:  { bg: Colors.surfaceRaised, text: Colors.textSecondary },
  primary:  { bg: Colors.primaryLight,  text: Colors.primary },
  success:  { bg: Colors.successLight,  text: Colors.success },
  warning:  { bg: Colors.warningLight,  text: Colors.warning },
  danger:   { bg: Colors.dangerLight,   text: Colors.danger },
  info:     { bg: Colors.infoLight,     text: Colors.info },
};

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  const { bg, text } = variantMap[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing[2.5],
    paddingVertical:   Spacing[0.5],
    borderRadius:      BorderRadius.full,
    alignSelf:         'flex-start',
  },
  text: {
    ...Typography.labelSmall,
  },
});
