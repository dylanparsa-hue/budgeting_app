import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
  label:    string;
  variant?: BadgeVariant;
  style?:   ViewStyle;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  const C = useTheme();

  const variantMap: Record<BadgeVariant, { bg: string; text: string }> = {
    default: { bg: C.surfaceRaised, text: C.textSecondary },
    primary: { bg: C.primaryLight,  text: C.primary },
    success: { bg: C.successLight,  text: C.success },
    warning: { bg: C.warningLight,  text: C.warning },
    danger:  { bg: C.dangerLight,   text: C.danger },
    info:    { bg: C.infoLight,     text: C.info },
  };

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
  text: { ...Typography.labelSmall },
});
