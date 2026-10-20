import type { BadgeDef } from '../game';

const TIERS = {
  bronze: ['#d9955f', '#a5632f'],
  silver: ['#d6d3ce', '#9a958d'],
  gold: ['#f6cc5c', '#d39b2a'],
};

/** Hexagon medallion; greyed out when locked. */
export default function Badge({ def, locked, size = 56 }: { def: BadgeDef; locked?: boolean; size?: number }) {
  const [light, dark] = locked ? ['var(--border)', 'var(--border)'] : TIERS[def.tier];
  const gid = `g-${def.id}-${locked ? 'l' : 'u'}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`badge${locked ? ' locked' : ''}`} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <polygon points="50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5" fill={`url(#${gid})`} />
      <polygon points="50,13 82,31.5 82,68.5 50,87 18,68.5 18,31.5" fill="none" stroke="#fff" strokeOpacity={locked ? 0.5 : 0.55} strokeWidth="3" />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Nunito Variable', system-ui, sans-serif"
        fontWeight="900"
        fontSize={def.glyph.length > 2 ? 24 : 30}
        fill={locked ? 'var(--muted)' : '#fff'}
      >
        {def.glyph}
      </text>
    </svg>
  );
}
