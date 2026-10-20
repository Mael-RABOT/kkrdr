import { score, scoreTier } from '../game';
import { fmtNum } from '../format';
import type { Poop } from '../types';

/** Score with a color from muted (low) to gold (high). */
export default function ScorePill({ poop, big }: { poop: Poop; big?: boolean }) {
  const s = score(poop);
  return <span className={`score ${scoreTier(s)}${big ? ' big' : ''}`}>{fmtNum(s)}</span>;
}
