import type { Level } from '../game';
import { useT, type Key } from '../i18n';

export default function LevelBar({ level, xp, compact }: { level: Level; xp: number; compact?: boolean }) {
  const t = useT();
  const pct = level.xpForNext ? Math.min(100, (level.xpInLevel / level.xpForNext) * 100) : 100;
  return (
    <div className={`levelbar${compact ? ' compact' : ''}`}>
      <div className="levelbar-top">
        <span className="level-chip">{t('profile.level', { n: level.level })}</span>
        <span className="level-title">{t(`level.${level.title}` as Key)}</span>
        {!compact && <span className="muted level-xp">{t('profile.xp', { xp })}</span>}
      </div>
      <div className="xp-track">
        <span className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
      {!compact && level.xpForNext && (
        <span className="hint">{t('profile.toNext', { n: level.xpForNext - level.xpInLevel })}</span>
      )}
    </div>
  );
}
