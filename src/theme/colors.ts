/**
 * Waddl color palette — drop-in replacement.
 * Lime (#9FE870) primary, ink (#0E2417) dark hero, off-white (#F6F8F4) surface.
 */

export const lightColors = {
  primary:        '#9FE870',
  primaryLight:   '#E6F9D9',
  primaryDark:    '#79C247',

  secondary:      '#0E2417',
  secondaryLight: '#1A2B22',
  secondaryDark:  '#000000',

  accent:         '#9FE870',

  success:        '#3BB273',
  successLight:   '#E1F3E8',
  warning:        '#F5B544',
  warningLight:   '#FDF1D9',
  danger:         '#E85D5D',
  dangerLight:    '#FBE2E2',
  info:           '#5B9DEB',
  infoLight:      '#E1ECFB',

  white:          '#FFFFFF',
  black:          '#0E2417',
  background:     '#F6F8F4',
  surface:        '#FFFFFF',
  surfaceRaised:  '#F6F8F4',
  surfaceCard:    '#FFFFFF',

  textPrimary:    '#0E2417',
  textSecondary:  '#4A5A52',
  textTertiary:   '#8A9A92',
  textInverse:    '#FFFFFF',

  border:         '#E8EDE6',
  borderLight:    '#EEF1EA',
  divider:        '#EEF1EA',

  heroGrad:       ['#0E2417', '#1A2B22'] as string[],

  chart: ['#9FE870', '#5B9DEB', '#9B7EE0', '#FF8A65', '#E97FB5', '#F5B544'],

  gradients: {
    primary:   ['#9FE870', '#79C247'] as string[],
    secondary: ['#0E2417', '#1A2B22'] as string[],
    hero:      ['#0E2417', '#1A2B22'] as string[],
    emerald:   ['#9FE870', '#C8F09C'] as string[],
    blue:      ['#5B9DEB', '#A9CBF5'] as string[],
    sunset:    ['#FF8A65', '#FFB199'] as string[],
    violet:    ['#9B7EE0', '#B8A4ED'] as string[],
    dark:      ['#0E2417', '#1A2B22'] as string[],
  },

  category: {
    food:          '#FF8A65',
    transport:     '#5B9DEB',
    bills:         '#F5B544',
    shopping:      '#E97FB5',
    entertainment: '#9B7EE0',
    health:        '#E85D5D',
    education:     '#5BCFCF',
    others:        '#8A9A92',
    salary:        '#3BB273',
    freelance:     '#5B9DEB',
    investment:    '#79C247',
    gift:          '#E97FB5',
  },

  isDark: false,
} as const;

export const darkColors = {
  primary:        '#B4F087',
  primaryLight:   '#1F3A12',
  primaryDark:    '#9FE870',

  secondary:      '#9FE870',
  secondaryLight: '#1F3A12',
  secondaryDark:  '#C8F09C',

  accent:         '#B4F087',

  success:        '#6FD49A',
  successLight:   '#0F2A1B',
  warning:        '#F7C76A',
  warningLight:   '#3A2A0A',
  danger:         '#F08A8A',
  dangerLight:    '#3A1414',
  info:           '#88BBF0',
  infoLight:      '#13243A',

  white:          '#FFFFFF',
  black:          '#0E2417',
  background:     '#0A1A11',
  surface:        '#162822',
  surfaceRaised:  '#1F362D',
  surfaceCard:    '#162822',

  textPrimary:    '#F4F8F2',
  textSecondary:  '#B8C5BD',
  textTertiary:   '#6B7D72',
  textInverse:    '#0E2417',

  border:         '#26392F',
  borderLight:    '#1F362D',
  divider:        '#1F362D',

  heroGrad:       ['#0A1A11', '#162822'] as string[],

  chart: ['#B4F087', '#88BBF0', '#B8A4ED', '#FFB199', '#F2A4CC', '#F7C76A'],

  gradients: {
    primary:   ['#9FE870', '#79C247'] as string[],
    secondary: ['#162822', '#1F362D'] as string[],
    hero:      ['#0A1A11', '#162822'] as string[],
    emerald:   ['#9FE870', '#C8F09C'] as string[],
    blue:      ['#88BBF0', '#B8D2F5'] as string[],
    sunset:    ['#FFB199', '#FFC9B8'] as string[],
    violet:    ['#B8A4ED', '#D1C2F4'] as string[],
    dark:      ['#162822', '#1F362D'] as string[],
  },

  category: {
    food:          '#FFB199',
    transport:     '#88BBF0',
    bills:         '#F7C76A',
    shopping:      '#F2A4CC',
    entertainment: '#B8A4ED',
    health:        '#F08A8A',
    education:     '#84DEDE',
    others:        '#B8C5BD',
    salary:        '#6FD49A',
    freelance:     '#88BBF0',
    investment:    '#9FE870',
    gift:          '#F2A4CC',
  },

  isDark: true,
} as const;

export const Colors = lightColors;
