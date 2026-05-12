/**
 * Waddl typography — Sora display + Manrope body + Geist Mono numerals.
 * FontFamily values use the loaded font names; falls back gracefully to System
 * if fonts haven't loaded yet.
 */
import { TextStyle } from 'react-native';

export const FontFamily = {
  display:     'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  regular:     'Manrope_400Regular',
  medium:      'Manrope_500Medium',
  semibold:    'Manrope_600SemiBold',
  bold:        'Manrope_700Bold',
  mono:        'GeistMono_500Medium',
} as const;

export const FontSize = {
  xs:    11,
  sm:    13,
  base:  15,
  md:    16,
  lg:    18,
  xl:    22,
  '2xl': 28,
  '3xl': 34,
  '4xl': 44,
  '5xl': 56,
} as const;

export const LineHeight = {
  tight:  1.15,
  snug:   1.3,
  normal: 1.5,
  loose:  1.7,
} as const;

const tight = -0.4;

export const Typography = {
  displayLarge: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize['5xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -1.2,
    lineHeight: FontSize['5xl'] * LineHeight.tight,
  },
  displayMedium: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize['4xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.8,
    lineHeight: FontSize['4xl'] * LineHeight.tight,
  },
  headingLarge: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize['3xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: tight,
    lineHeight: FontSize['3xl'] * LineHeight.tight,
  },
  headingMedium: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize.xl,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: tight,
    lineHeight: FontSize.xl * LineHeight.snug,
  },
  headingSmall: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize.lg,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: FontSize.lg * LineHeight.snug,
  },
  titleMedium: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.md,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: FontSize.md * LineHeight.snug,
  },
  titleSmall: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.base,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: FontSize.base * LineHeight.snug,
  },
  bodyLarge: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.md,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: FontSize.md * LineHeight.normal,
  },
  bodyMedium: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.base,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: FontSize.base * LineHeight.normal,
  },
  bodySmall: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.sm,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  labelLarge: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.base,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: FontSize.base * LineHeight.snug,
  },
  labelSmall: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.xs,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.4,
    lineHeight: FontSize.xs * LineHeight.snug,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize:   FontSize.xs,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: FontSize.xs * LineHeight.normal,
  },
  amount: {
    fontFamily: FontFamily.display,
    fontSize:   FontSize['3xl'],
    fontWeight: '800' as TextStyle['fontWeight'],
    letterSpacing: -1,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
  amountSmall: {
    fontFamily: FontFamily.semibold,
    fontSize:   FontSize.xl,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
} as const;
