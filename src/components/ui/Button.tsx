import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label:       string;
  onPress:     () => void;
  variant?:    Variant;
  size?:       Size;
  loading?:    boolean;
  disabled?:   boolean;
  icon?:       React.ReactNode;
  iconRight?:  React.ReactNode;
  fullWidth?:  boolean;
  style?:      ViewStyle;
}

const sizeMap: Record<Size, { height: number; px: number; text: TextStyle }> = {
  sm: { height: 36, px: Spacing[3], text: Typography.labelSmall  },
  md: { height: 48, px: Spacing[5], text: Typography.titleSmall  },
  lg: { height: 56, px: Spacing[6], text: Typography.titleMedium },
};

export function Button({
  label,
  onPress,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  icon,
  iconRight,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { height, px, text } = sizeMap[size];
  const isDisabled           = disabled || loading;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white}
          size="small"
        />
      ) : (
        <>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[text, textColorMap[variant], isDisabled && styles.disabledText]}>
            {label}
          </Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[fullWidth && styles.fullWidth, style]}
      >
        <LinearGradient
          colors={isDisabled ? [Colors.textTertiary, Colors.textTertiary] : Colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, { height, paddingHorizontal: px }]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        { height, paddingHorizontal: px },
        variantStyleMap[variant],
        isDisabled && styles.disabledBase,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

const variantStyleMap: Record<Exclude<Variant, 'primary'>, ViewStyle> = {
  secondary: { backgroundColor: Colors.secondaryLight },
  outline:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  ghost:     { backgroundColor: 'transparent' },
  danger:    { backgroundColor: Colors.dangerLight },
};

const textColorMap: Record<Variant, TextStyle> = {
  primary:   { color: Colors.white },
  secondary: { color: Colors.secondary },
  outline:   { color: Colors.primary },
  ghost:     { color: Colors.primary },
  danger:    { color: Colors.danger },
};

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   BorderRadius.xl,
  },
  fullWidth:    { width: '100%' },
  disabledBase: { opacity: 0.5 },
  disabledText: { opacity: 0.6 },
  iconLeft:  { marginRight: Spacing[2] },
  iconRight: { marginLeft:  Spacing[2] },
});
