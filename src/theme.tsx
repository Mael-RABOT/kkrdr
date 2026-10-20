import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { readPref, writePref } from './prefs';

export type Theme = 'system' | 'light' | 'dark';

const BG = { light: '#faf6f0', dark: '#1a1511' };

function saved(): Theme {
  const t = readPref('theme');
  return t === 'light' || t === 'dark' ? t : 'system';
}

/** Applies the theme to <html> and the browser chrome color. index.html does the same before first paint. */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.dataset.scheme as 'light' | 'dark';
    m.content = BG[theme === 'system' ? scheme : theme];
  });
}

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(saved);

  useEffect(() => apply(theme), [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    writePref('theme', t);
  };

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme outside provider');
  return c;
}
