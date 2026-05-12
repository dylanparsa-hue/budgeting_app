import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing, Shadow } from '../../theme/spacing';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label:      string;
  onPress:    () => void;
  variant?:   Variant;
  size?:      Size;
  loading?:   boolean;
  disabled?:  boolean;
  icon?:      React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  style?:     ViewStyle;
}

const sizeMap: Record<Size, { height: number; px: number; text: TextStyle }> = {
  sm: { height: 36, px: Spacing[3],  text: Typography.labelSmall  },
  md: { height: 48, px: Spacing[5],  text: Typography.titleSmall  },
  lg: { height: 56, px: Spacing[6],  text: Typography.titleMedium },
};

export function Button({
  label, onPress,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  icon, iconRight,
  fullWidth = false,
  style,
}: ButtonProps) {
  const C = useTheme();
  const { height, px, text } = sizeMap[size];
  const isDisabled = disabled || loading;

  const variantStyleMap: Record<Variant, ViewStyle> = {
    primary:   { backgroundColor: C.primary },
    secondary: { backgroundColor: C.black },
    outline:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.border },
    ghost:     { backgroundColor: 'transparent' },
    danger:    { backgroundColor: C.dangerLight },
  };

  const textColorMap: Record<Variant, TextStyle> = {
    primary:   { color: C.black },
    secondary: { color: '#FFFFFF' },
    outline:   { color: C.textPrimary },
    ghost:     { color: C.textPrimary },
    danger:    { color: C.danger },
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        styles.base,
        { height, paddingHorizontal: px },
        variantStyleMap[variant],
        isDisabled && styles.disabledBase,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? C.black : variant === 'secondary' ? '#fff' : C.textPrimary}
          size="small"
        />
      ) : (
        <>
          {icon     && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[text, textColorMap[variant], isDisabled && styles.disabledText]}>{label}</Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </>
      )}
    </TouchableOpacity>
  );
}

export function FAB({ onPress, icon }: { onPress: () => void; icon?: React.ReactNode }) {
  const C = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.fab, { backgroundColor: C.primary }, Shadow.xl]}
    >
      {icon ?? <Text style={{ fontSize: 28, color: C.black, lineHeight: 32 }}>+</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  fullWidth:    { width: '100%' },
  disabledBase: { opacity: 0.45 },
  disabledText: { opacity: 0.6 },
  iconLeft:  { marginRight: Spacing[2] },
  iconRight: { marginLeft:  Spacing[2] },
  fab: {
    width: 56, height: 56, borderRadius: 9999,
    alignItems: 'center', justifyContent: 'center',
  },
});
