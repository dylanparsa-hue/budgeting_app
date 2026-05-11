import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';

interface CardProps {
  children:  React.ReactNode;
  onPress?:  () => void;
  style?:    ViewStyle;
  padding?:  number;
  elevated?: boolean;
}

export function Card({ children, onPress, style, padding = Spacing[4], elevated = false }: CardProps) {
  const C = useTheme();
  const containerStyle: ViewStyle[] = [
    styles.card,
    { backgroundColor: C.surface },
    elevated ? Shadow.lg : Shadow.md,
    { padding },
    style ?? {},
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={containerStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    overflow:     'hidden',
  },
});
