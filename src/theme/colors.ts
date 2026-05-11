export const lightColors = {
  // ── Brand ──────────────────────────────────────────────
  primary:        '#10B981', // emerald
  primaryLight:   '#ECFDF5',
  primaryDark:    '#059669',

  secondary:      '#3B82F6', // deep blue
  secondaryLight: '#EFF6FF',
  secondaryDark:  '#2563EB',

  accent:         '#8B5CF6', // violet

  // ── Semantic ───────────────────────────────────────────
  success:        '#10B981',
  successLight:   '#ECFDF5',
  warning:        '#F59E0B',
  warningLight:   '#FFFBEB',
  danger:         '#EF4444',
  dangerLight:    '#FEF2F2',
  info:           '#3B82F6',
  infoLight:      '#EFF6FF',

  // ── Surfaces ───────────────────────────────────────────
  white:          '#FFFFFF',
  black:          '#0F172A',
  background:     '#F1F5F9',
  surface:        '#FFFFFF',
  surfaceRaised:  '#F8FAFC',
  surfaceCard:    '#FFFFFF',

  // ── Text ───────────────────────────────────────────────
  textPrimary:    '#0F172A',
  textSecondary:  '#475569',
  textTertiary:   '#94A3B8',
  textInverse:    '#FFFFFF',

  // ── Border ─────────────────────────────────────────────
  border:         '#E2E8F0',
  borderLight:    '#F1F5F9',
  divider:        '#F1F5F9',

  // ── Hero gradient (dark card on light bg) ──────────────
  heroGrad:       ['#0F172A', '#1E3A5F'] as string[],

  // ── Chart ──────────────────────────────────────────────
  chart: ['#10B981', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899', '#F59E0B'],

  // ── Gradients ──────────────────────────────────────────
  gradients: {
    primary:   ['#10B981', '#059669'] as string[],
    secondary: ['#3B82F6', '#2563EB'] as string[],
    hero:      ['#0F172A', '#0D3251'] as string[],
    emerald:   ['#10B981', '#6EE7B7'] as string[],
    blue:      ['#3B82F6', '#93C5FD'] as string[],
    sunset:    ['#F97316', '#FB923C'] as string[],
    violet:    ['#8B5CF6', '#A78BFA'] as string[],
    dark:      ['#1E293B', '#334155'] as string[],
  },

  // ── Category colors ────────────────────────────────────
  category: {
    food:          '#F97316',
    transport:     '#3B82F6',
    bills:         '#EAB308',
    shopping:      '#EC4899',
    entertainment: '#8B5CF6',
    health:        '#EF4444',
    education:     '#06B6D4',
    others:        '#6B7280',
    salary:        '#10B981',
    freelance:     '#6366F1',
    investment:    '#059669',
    gift:          '#F43F5E',
  },

  isDark: false,
} as const;

export const darkColors = {
  primary:        '#10B981',
  primaryLight:   '#064E3B',
  primaryDark:    '#34D399',

  secondary:      '#3B82F6',
  secondaryLight: '#1E3A5F',
  secondaryDark:  '#60A5FA',

  accent:         '#A78BFA',

  success:        '#34D399',
  successLight:   '#064E3B',
  warning:        '#FCD34D',
  warningLight:   '#451A03',
  danger:         '#F87171',
  dangerLight:    '#450A0A',
  info:           '#60A5FA',
  infoLight:      '#1E3A5F',

  white:          '#FFFFFF',
  black:          '#0F172A',
  background:     '#0F172A',
  surface:        '#1E293B',
  surfaceRaised:  '#334155',
  surfaceCard:    '#1E293B',

  textPrimary:    '#F8FAFC',
  textSecondary:  '#CBD5E1',
  textTertiary:   '#64748B',
  textInverse:    '#0F172A',

  border:         '#334155',
  borderLight:    '#1E293B',
  divider:        '#1E293B',

  heroGrad:       ['#10B981', '#3B82F6'] as string[],

  chart: ['#10B981', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899', '#F59E0B'],

  gradients: {
    primary:   ['#10B981', '#059669'] as string[],
    secondary: ['#3B82F6', '#2563EB'] as string[],
    hero:      ['#10B981', '#3B82F6'] as string[],
    emerald:   ['#059669', '#10B981'] as string[],
    blue:      ['#2563EB', '#3B82F6'] as string[],
    sunset:    ['#F97316', '#FB923C'] as string[],
    violet:    ['#7C3AED', '#8B5CF6'] as string[],
    dark:      ['#1E293B', '#334155'] as string[],
  },

  category: {
    food:          '#F97316',
    transport:     '#3B82F6',
    bills:         '#EAB308',
    shopping:      '#EC4899',
    entertainment: '#8B5CF6',
    health:        '#EF4444',
    education:     '#06B6D4',
    others:        '#6B7280',
    salary:        '#10B981',
    freelance:     '#6366F1',
    investment:    '#059669',
    gift:          '#F43F5E',
  },

  isDark: true,
} as const;

// Legacy export so existing imports don't break
export const Colors = lightColors;
