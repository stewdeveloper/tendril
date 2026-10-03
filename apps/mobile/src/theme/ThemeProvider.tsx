import {
  colors,
  rarityColors,
  verdictColors,
  type ColorTokens,
  type RarityTier,
  type Scheme,
  type Severity,
} from '@tendril/core';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export interface Theme {
  scheme: Scheme;
  c: ColorTokens;
  verdict: Record<Severity, string>;
  rarity: Record<RarityTier, string>;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ scheme, children }: { scheme?: Scheme; children: ReactNode }) {
  const system = useColorScheme();
  const resolved: Scheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo<Theme>(
    () => ({
      scheme: resolved,
      c: colors[resolved],
      verdict: verdictColors[resolved],
      rarity: rarityColors[resolved],
    }),
    [resolved],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}
