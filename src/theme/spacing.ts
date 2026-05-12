/**
 * Waddl spacing + radius + shadow tokens (4px base grid).
 */

export const Spacing = {
  0:    0,
  0.5:  2,
  1:    4,
  1.5:  6,
  2:    8,
  2.5:  10,
  3:    12,
  3.5:  14,
  4:    16,
  5:    20,
  6:    24,
  7:    28,
  8:    32,
  9:    36,
  10:   40,
  12:   48,
  14:   56,
  16:   64,
  20:   80,
  24:   96,
} as const;

/**
 * cards: 2xl (20), hero: 3xl (28), buttons/chips: xl (16), inputs: lg (14).
 */
export const BorderRadius = {
  none:  0,
  sm:    8,
  md:    12,
  lg:    14,
  xl:    16,
  '2xl': 20,
  '3xl': 28,
  full:  9999,
} as const;

/**
 * Soft green-ink shadows — never harsh black.
 * shadowColor uses ink (#0E2417) which iOS renders tinted.
 */
export const Shadow = {
  none: {},
  sm: {
    shadowColor:   '#0E2417',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius:  4,
    elevation:     1,
  },
  md: {
    shadowColor:   '#0E2417',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  12,
    elevation:     3,
  },
  lg: {
    shadowColor:   '#0E2417',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius:  24,
    elevation:     6,
  },
  xl: {
    // Lime glow — FAB / primary CTA only
    shadowColor:   '#9FE870',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius:  20,
    elevation:     10,
  },
} as const;
