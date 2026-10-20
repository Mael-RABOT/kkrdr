import { useT } from '../i18n';
import { useTheme, type Theme } from '../theme';

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

function Icon({ theme }: { theme: Theme }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      {theme === 'light' && (
        <>
          <circle cx="12" cy="12" r="4" {...common} />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...common} />
        </>
      )}
      {theme === 'dark' && <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" {...common} />}
      {theme === 'system' && (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** One button cycling system → light → dark. */
export default function ThemeSwitch() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const label = t(`theme.${theme}`);
  return (
    <button type="button" className="icon-switch" onClick={() => setTheme(NEXT[theme])} aria-label={label} title={label}>
      <Icon theme={theme} />
    </button>
  );
}
