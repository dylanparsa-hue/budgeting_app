import React, { useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity,
  StyleSheet, TextInputProps, ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Typography, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?:          string;
  error?:          string;
  hint?:           string;
  leftIcon?:       React.ReactNode;
  rightIcon?:      React.ReactNode;
  onRightPress?:   () => void;
  containerStyle?: ViewStyle;
}

export function Input({
  label, error, hint, leftIcon, rightIcon, onRightPress, containerStyle, ...props
}: InputProps) {
  const C = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: C.textPrimary }]}>{label}</Text>}
      <View
        style={[
          styles.inputRow,
          { backgroundColor: C.surfaceRaised, borderColor: C.border },
          focused && { borderColor: C.primary, backgroundColor: C.primaryLight },
          !!error && { borderColor: C.danger },
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          {...props}
          onFocus={e => { setFocused(true); props.onFocus?.(e); }}
          onBlur={e  => { setFocused(false); props.onBlur?.(e); }}
          style={[
            styles.input,
            { color: C.textPrimary },
            leftIcon  ? styles.inputWithLeft  : null,
            rightIcon ? styles.inputWithRight : null,
          ]}
          placeholderTextColor={C.textTertiary}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightPress} disabled={!onRightPress} style={styles.rightIcon}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: C.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hintText, { color: C.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface AmountInputProps {
  value:        string;
  onChangeText: (v: string) => void;
  currency?:    string;
  style?:       ViewStyle;
}

export function AmountInput({ value, onChangeText, currency = 'RM', style }: AmountInputProps) {
  const C = useTheme();
  return (
    <View style={[styles.amountContainer, style]}>
      <Text style={[styles.currencySymbol, { color: C.textSecondary }]}>{currency}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={C.textTertiary}
        style={[styles.amountInput, { color: C.textPrimary }]}
        maxLength={12}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { gap: Spacing[1.5] },
  label:      { ...Typography.labelLarge },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.lg, borderWidth: 1.5, height: 52,
  },
  input: {
    flex: 1, paddingHorizontal: Spacing[4], ...Typography.bodyMedium,
  },
  inputWithLeft:  { paddingLeft:  Spacing[1] },
  inputWithRight: { paddingRight: Spacing[1] },
  leftIcon:  { paddingLeft:  Spacing[4] },
  rightIcon: { paddingRight: Spacing[4] },
  errorText: { ...Typography.caption },
  hintText:  { ...Typography.caption },

  amountContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', paddingVertical: Spacing[4],
  },
  currencySymbol: {
    fontSize: FontSize.xl, fontWeight: '600',
    marginBottom: 4, marginRight: Spacing[1],
  },
  amountInput: {
    fontSize: FontSize['4xl'], fontWeight: '700',
    letterSpacing: -1, minWidth: 80, textAlign: 'center',
  },
});
