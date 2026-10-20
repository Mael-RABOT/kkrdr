import { score } from '../game';
import { fmtNum } from '../format';
import type { Poop } from '../types';

/** Score with a color from muted (low) to gold (high). */
export default function ScorePill({ poop, big }: { poop: Poop; big?: boolean }) {
  const s = score(poop);
  const tier = s >= 9 ? 'gold' : s >= 6 ? 'good' : s >= 3 ? 'mid' : 'low';
  return <span className={`score ${tier}${big ? ' big' : ''}`}>{fmtNum(s)}</span>;
}
