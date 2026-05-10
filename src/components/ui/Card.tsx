import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';

interface CardProps {
  children:   React.ReactNode;
  onPress?:   () => void;
  style?:     ViewStyle;
  padding?:   number;
  elevated?:  boolean;
}

export function Card({ children, onPress, style, padding = Spacing[4], elevated = false }: CardProps) {
  const containerStyle: ViewStyle[] = [
    styles.card,
    elevated ? Shadow.lg : Shadow.md,
    { padding },
    style ?? {},
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.82}
        style={containerStyle}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    BorderRadius.xl,
    overflow:        'hidden',
  },
});
