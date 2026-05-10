import { TextStyle } from 'react-native';

export const FontFamily = {
  regular:     'System',
  medium:      'System',
  semibold:    'System',
  bold:        'System',
} as const;

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 42,
} as const;

export const LineHeight = {
  tight:  1.2,
  normal: 1.5,
  loose:  1.8,
} as const;

export const Typography = {
  displayLarge: {
    fontSize:   FontSize['4xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.5,
    lineHeight: FontSize['4xl'] * 1.2,
  },
  displayMedium: {
    fontSize:   FontSize['3xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.3,
    lineHeight: FontSize['3xl'] * 1.2,
  },
  headingLarge: {
    fontSize:   FontSize['2xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.2,
    lineHeight: FontSize['2xl'] * 1.3,
  },
  headingMedium: {
    fontSize:   FontSize.xl,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: -0.1,
    lineHeight: FontSize.xl * 1.3,
  },
  headingSmall: {
    fontSize:   FontSize.lg,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: FontSize.lg * 1.4,
  },
  titleMedium: {
    fontSize:   FontSize.md,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: FontSize.md * 1.4,
  },
  titleSmall: {
    fontSize:   FontSize.base,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: FontSize.base * 1.4,
  },
  bodyLarge: {
    fontSize:   FontSize.md,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: FontSize.md * 1.5,
  },
  bodyMedium: {
    fontSize:   FontSize.base,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: FontSize.base * 1.5,
  },
  bodySmall: {
    fontSize:   FontSize.sm,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: FontSize.sm * 1.5,
  },
  labelLarge: {
    fontSize:   FontSize.base,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: FontSize.base * 1.4,
  },
  labelSmall: {
    fontSize:   FontSize.xs,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: 0.4,
    lineHeight: FontSize.xs * 1.4,
  },
  caption: {
    fontSize:   FontSize.xs,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: FontSize.xs * 1.5,
  },
  amount: {
    fontSize:   FontSize['3xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
  amountSmall: {
    fontSize:   FontSize.xl,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
} as const;
