import { useId } from 'react';

/** Small shaded drawing of each Bristol type (1 = separate hard lumps … 7 = liquid). */
export default function TypeIcon({ type, size = 44 }: { type: number; size?: number }) {
  const id = useId().replace(/:/g, '');
  const solid = `url(#s${id})`;
  const soft = `url(#m${id})`;
  const tube = `url(#t${id})`;
  const hi = { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeLinecap: 'round' as const };

  return (
    <svg width={size} height={(size * 40) / 64} viewBox="0 0 64 40" aria-hidden className="type-icon">
      <defs>
        <radialGradient id={`s${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#a8703f" />
          <stop offset="0.6" stopColor="#74482a" />
          <stop offset="1" stopColor="#4f2f19" />
        </radialGradient>
        <radialGradient id={`m${id}`} cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#b98552" />
          <stop offset="1" stopColor="#7d5232" />
        </radialGradient>
        <linearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a653a" />
          <stop offset="1" stopColor="#5a371e" />
        </linearGradient>
      </defs>

      {type === 1 && (
        <g fill={solid}>
          <circle cx="12" cy="24" r="6" />
          <circle cx="26" cy="17" r="5.2" />
          <circle cx="38" cy="26" r="6.2" />
          <circle cx="50" cy="16" r="4.6" />
          <circle cx="55" cy="28" r="3.8" />
        </g>
      )}

      {type === 2 && (
        <g fill={solid}>
          <circle cx="12" cy="22" r="7" />
          <circle cx="21" cy="19" r="7.8" />
          <circle cx="30" cy="22" r="7.4" />
          <circle cx="39" cy="19" r="7.8" />
          <circle cx="48" cy="21.5" r="7.2" />
          <circle cx="55" cy="20" r="5" />
        </g>
      )}

      {type === 3 && (
        <>
          <path d="M9 23 Q32 15 55 22" fill="none" stroke={tube} strokeWidth="13" strokeLinecap="round" />
          <g fill="none" stroke="#2e1a0c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 15l2 4-1.5 4" />
            <path d="M25 13l-1.6 4.5 2 4" />
            <path d="M34 12.5l1.8 4-1.4 4.5" />
            <path d="M43 13.5l-1.6 4 1.6 4" />
            <path d="M51 16l1 3-1 3" />
          </g>
        </>
      )}

      {type === 4 && (
        <>
          <path d="M9 25 Q20 12 32 20 T55 16" fill="none" stroke={tube} strokeWidth="12" strokeLinecap="round" />
          <path d="M14 19.5 Q21 14 29 17" {...hi} strokeWidth="2" />
        </>
      )}

      {type === 5 && (
        <g fill={soft}>
          <ellipse cx="13" cy="25" rx="9" ry="6.5" />
          <ellipse cx="32" cy="18" rx="9.5" ry="7" />
          <ellipse cx="50" cy="25" rx="9" ry="6" />
        </g>
      )}

      {type === 6 && (
        <g fill={soft} transform="translate(-5 -9) scale(1.18)">
          <path d="M7 30c-2-3 1-6 4-5 0-4 4-6 7-4 1-4 6-5 8-2 2-3 7-3 8 0 2-2 7-1 7 2 3-1 6 1 6 4 3 0 5 3 3 5H9c-1 0-1.6 0-2 0z" />
          <circle cx="56" cy="22" r="2.4" />
          <circle cx="9" cy="20" r="1.8" />
        </g>
      )}

      {type === 7 && (
        <>
          <path
            d="M6 29c0-4 6-6 12-6 4 0 6-2 11-2 6 0 8 2 13 2 6 0 16 1 16 5 0 3-6 5-14 5-5 0-7-1-12-1s-8 2-15 1c-6-.5-11-2-11-4z"
            fill="#9c6a3e"
            opacity="0.9"
          />
          <ellipse cx="34" cy="27" rx="9" ry="2" {...hi} strokeWidth="1.4" />
        </>
      )}
    </svg>
  );
}
