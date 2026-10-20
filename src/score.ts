import type { Poop } from './types';

/** 1.0 for type 4 (smooth), minus 0.25 per step away from it. */
export function textureFactor(type: number): number {
  return Math.max(0, 1 - Math.abs(type - 4) * 0.25);
}

/** Texture x rating, scaled to 0..10. Unrated entries count as 3/5. */
export function baseScore(p: Pick<Poop, 'type' | 'rating'>): number {
  return textureFactor(p.type) * (p.rating ?? 3) * 2;
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

export interface Ranked {
  userId: string;
  points: number;
  count: number;
  poops: Poop[];
  best: Poop;
}

/**
 * People ranked by total points over a set of entries: most points first, then most entries,
 * then best single poop. Used by both the leaderboard and the week / month awards.
 */
export function rankUsers(poops: Poop[]): Ranked[] {
  const byUser = new Map<string, Poop[]>();
  for (const p of poops) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, []);
    byUser.get(p.userId)!.push(p);
  }
  return [...byUser.entries()]
    .map(([userId, list]) => ({
      userId,
      points: list.reduce((a, p) => a + score(p), 0),
      count: list.length,
      poops: list,
      best: best(list)!,
    }))
    .sort(
      (a, b) =>
        b.points - a.points || b.count - a.count || score(b.best) - score(a.best) || a.userId.localeCompare(b.userId),
    );
}
