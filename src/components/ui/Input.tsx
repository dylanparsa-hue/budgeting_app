import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?:       string;
  error?:       string;
  hint?:        string;
  leftIcon?:    React.ReactNode;
  rightIcon?:   React.ReactNode;
  onRightPress?: () => void;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightPress,
  containerStyle,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputRow,
          focused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          {...props}
          onFocus={e => { setFocused(true); props.onFocus?.(e); }}
          onBlur={e  => { setFocused(false); props.onBlur?.(e); }}
          style={[styles.input, leftIcon && styles.inputWithLeft, rightIcon && styles.inputWithRight]}
          placeholderTextColor={Colors.textTertiary}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightPress}
            disabled={!onRightPress}
            style={styles.rightIcon}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ── Large amount input (used in Add Transaction) ───────────────────────────────
interface AmountInputProps {
  value:       string;
  onChangeText: (v: string) => void;
  currency?:   string;
  style?:      ViewStyle;
}

export function AmountInput({ value, onChangeText, currency = 'RM', style }: AmountInputProps) {
  return (
    <View style={[styles.amountContainer, style]}>
      <Text style={styles.currencySymbol}>{currency}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={Colors.textTertiary}
        style={styles.amountInput}
        maxLength={12}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing[1.5],
  },
  label: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
  },
  inputRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius:    BorderRadius.lg,
    borderWidth:     1.5,
    borderColor:     Colors.border,
    height:          52,
  },
  inputFocused: {
    borderColor:     Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  input: {
    flex:        1,
    paddingHorizontal: Spacing[4],
    ...Typography.bodyMedium,
    color:       Colors.textPrimary,
  },
  inputWithLeft:  { paddingLeft:  Spacing[1] },
  inputWithRight: { paddingRight: Spacing[1] },
  leftIcon:  { paddingLeft:  Spacing[4] },
  rightIcon: { paddingRight: Spacing[4] },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
  },
  hintText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // Amount input
  amountContainer: {
    flexDirection:   'row',
    alignItems:      'flex-end',
    justifyContent:  'center',
    paddingVertical: Spacing[4],
  },
  currencySymbol: {
    fontSize:    FontSize.xl,
    fontWeight:  '600',
    color:       Colors.textSecondary,
    marginBottom: 4,
    marginRight:  Spacing[1],
  },
  amountInput: {
    fontSize:    FontSize['4xl'],
    fontWeight:  '700',
    color:       Colors.textPrimary,
    letterSpacing: -1,
    minWidth:    80,
    textAlign:   'center',
  },
});
