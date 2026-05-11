import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from './colors';

type ThemeColors = typeof lightColors;

const ThemeContext = createContext<ThemeColors>(lightColors);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? darkColors : lightColors) as ThemeColors;
  return (
    <ThemeContext.Provider value={colors}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeColors => useContext(ThemeContext);
