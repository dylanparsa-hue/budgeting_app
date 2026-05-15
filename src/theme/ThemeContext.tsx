import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from './colors';
import { useAppSettingsStore } from '../stores/appSettingsStore';

type ThemeColors = typeof lightColors;

const ThemeContext = createContext<ThemeColors>(lightColors);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme    = useColorScheme();          // 'light' | 'dark' | null
  const themeMode = useAppSettingsStore(s => s.themeMode);

  // Resolve: explicit override first, then fall back to system
  const isDark =
    themeMode === 'dark'  ? true  :
    themeMode === 'light' ? false :
    scheme === 'dark';

  const colors = (isDark ? darkColors : lightColors) as ThemeColors;

  return (
    <ThemeContext.Provider value={colors}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeColors => useContext(ThemeContext);
