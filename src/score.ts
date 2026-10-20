import type { Poop } from './types';

/** 1.0 for type 4 (smooth), minus 0.25 per step away from it. */
export function textureFactor(type: number): number {
  return Math.max(0, 1 - Math.abs(type - 4) * 0.25);
}

/** Texture x rating, scaled to 0..10. Unrated entries count as 3/5. */
export function baseScore(p: Pick<Poop, 'type' | 'rating'>): number {
  return textureFactor(p.type) * (p.rating ?? 3) * 2;
}

export type ScoreTier = 'low' | 'mid' | 'good' | 'gold';

/** Colour band of a score, from muted (low) to gold (high). */
export function scoreTier(s: number): ScoreTier {
  return s >= 9 ? 'gold' : s >= 6 ? 'good' : s >= 3 ? 'mid' : 'low';
}

export function netVotes(p: Pick<Poop, 'votes'>): number {
  return Object.values(p.votes ?? {}).reduce<number>((a, v) => a + v, 0);
}

export function score(p: Pick<Poop, 'type' | 'rating' | 'votes'>): number {
  return baseScore(p) + netVotes(p);
}

/** Best entry of a set: highest score, then highest base, then earliest. */
export function best(poops: Poop[]): Poop | undefined {
  let top: Poop | undefined;
  for (const p of poops) {
    if (
      !top ||
      score(p) > score(top) ||
      (score(p) === score(top) && (baseScore(p) > baseScore(top) || (baseScore(p) === baseScore(top) && p.at < top.at)))
    )
      top = p;
  }
  return top;
}

/** Why someone ranks below the person just above them despite equal points. */
export type TieBreak = 'avg' | 'best' | 'first' | 'shared';

export interface Ranked {
  userId: string;
  points: number;
  count: number;
  /** Average score per poop. */
  avg: number;
  poops: Poop[];
  best: Poop;
  /** When their last poop of the set happened, i.e. when they reached their total. */
  reachedAt: Date;
  /** 1-based; equal only when every tie-break is equal too. */
  rank: number;
  /** Set when points equal the person above: the rule that put them below (or 'shared'). */
  tie: TieBreak | null;
}

// Averages are fractions: compare them with a little slack.
const EPS = 1e-9;
const cmp = (a: number, b: number) => (Math.abs(a - b) < EPS ? 0 : a - b);

/** Tie-breaks for equal points, in order: better average, better best poop, reached the total first. */
function tieBreak(a: Omit<Ranked, 'rank' | 'tie'>, b: Omit<Ranked, 'rank' | 'tie'>): { order: number; rule: TieBreak } {
  const byAvg = cmp(b.avg, a.avg);
  if (byAvg) return { order: byAvg, rule: 'avg' };
  const byBest = cmp(score(b.best), score(a.best));
  if (byBest) return { order: byBest, rule: 'best' };
  const byTime = a.reachedAt.getTime() - b.reachedAt.getTime();
  if (byTime) return { order: byTime, rule: 'first' };
  return { order: 0, rule: 'shared' };
}

/**
 * People ranked by total points over a set of entries; equal points are split by {@link tieBreak}.
 * Used by the leaderboard and the week / month awards.
 */
export function rankUsers(poops: Poop[]): Ranked[] {
  const byUser = new Map<string, Poop[]>();
  for (const p of poops) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, []);
    byUser.get(p.userId)!.push(p);
  }
  const rows = [...byUser.entries()].map(([userId, list]) => {
    const points = list.reduce((a, p) => a + score(p), 0);
    return {
      userId,
      points,
      count: list.length,
      avg: points / list.length,
      poops: list,
      best: best(list)!,
      reachedAt: new Date(Math.max(...list.map((p) => p.at.getTime()))),
    };
  });
  // Fully tied people keep a stable (but meaningless) order by id.
  rows.sort((a, b) => cmp(b.points, a.points) || tieBreak(a, b).order || a.userId.localeCompare(b.userId));

  const ranked: Ranked[] = [];
  rows.forEach((r, i) => {
    const above = ranked[i - 1];
    if (!above || cmp(above.points, r.points) !== 0) {
      ranked.push({ ...r, rank: i + 1, tie: null });
      return;
    }
    const rule = tieBreak(above, r).rule;
    ranked.push({ ...r, rank: rule === 'shared' ? above.rank : i + 1, tie: rule });
  });
  return ranked;
}
