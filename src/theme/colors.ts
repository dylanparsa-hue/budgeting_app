export const Colors = {
  // ── Brand ─────────────────────────────────────────
  primary:        '#6366F1', // indigo
  primaryLight:   '#EEF2FF',
  primaryDark:    '#4F46E5',

  secondary:      '#10B981', // emerald
  secondaryLight: '#ECFDF5',
  secondaryDark:  '#059669',

  accent:         '#F97316', // orange

  // ── Semantic ──────────────────────────────────────
  success:        '#10B981',
  successLight:   '#ECFDF5',
  warning:        '#F59E0B',
  warningLight:   '#FFFBEB',
  danger:         '#EF4444',
  dangerLight:    '#FEF2F2',
  info:           '#3B82F6',
  infoLight:      '#EFF6FF',

  // ── Neutral ───────────────────────────────────────
  white:          '#FFFFFF',
  black:          '#0F172A',
  background:     '#F8FAFC',
  surface:        '#FFFFFF',
  surfaceRaised:  '#F1F5F9',

  // ── Text ──────────────────────────────────────────
  textPrimary:    '#0F172A',
  textSecondary:  '#64748B',
  textTertiary:   '#94A3B8',
  textInverse:    '#FFFFFF',

  // ── Border ────────────────────────────────────────
  border:         '#E2E8F0',
  borderLight:    '#F1F5F9',
  divider:        '#F1F5F9',

  // ── Chart palette ─────────────────────────────────
  chart: ['#6366F1', '#10B981', '#F97316', '#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6', '#06B6D4'],

  // ── Category colors ───────────────────────────────
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

  // ── Gradients (as arrays for LinearGradient) ──────
  gradients: {
    primary:   ['#6366F1', '#818CF8'],
    secondary: ['#10B981', '#34D399'],
    sunset:    ['#F97316', '#FB923C'],
    ocean:     ['#3B82F6', '#60A5FA'],
    rose:      ['#F43F5E', '#FB7185'],
    dark:      ['#1E293B', '#334155'],
  },
} as const;

export type ColorKey = keyof typeof Colors;
