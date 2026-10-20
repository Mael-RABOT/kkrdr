import { monthStart, weekStart } from './format';

export { monthStart, weekStart } from './format';
import { longestStreak } from './stats';
import { PLACE_IDS, type Poop } from './types';

export { baseScore, best, netVotes, rankUsers, score, textureFactor } from './score';
import { baseScore, best, netVotes, rankUsers, score } from './score';

// ---- periods ----

export type PeriodKind = 'week' | 'month';

export interface Award {
  kind: PeriodKind;
  start: Date;
  /** The winner: most points over the period (same as the leaderboard's #1). */
  userId: string;
  points: number;
  count: number;
  /** The winner's best poop of the period, shown as a highlight. */
  poop: Poop;
  /** false while the period is still running. */
  final: boolean;
}

/** Winner of every week (or month) that has entries, newest first. */
export function awards(poops: Poop[], kind: PeriodKind, now = new Date()): Award[] {
  const startOf = kind === 'week' ? weekStart : monthStart;
  const groups = new Map<number, Poop[]>();
  for (const p of poops) {
    const k = startOf(p.at).getTime();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  const current = startOf(now).getTime();
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([k, list]) => {
      const top = rankUsers(list)[0];
      return {
        kind,
        start: new Date(k),
        userId: top.userId,
        points: top.points,
        count: top.count,
        poop: top.best,
        final: k < current,
      };
    });
}

// ---- badges ----

export type Tier = 'bronze' | 'silver' | 'gold';

export interface BadgeDef {
  id: string;
  tier: Tier;
  glyph: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first', tier: 'bronze', glyph: '1' },
  { id: 'ten', tier: 'bronze', glyph: '10' },
  { id: 'fifty', tier: 'silver', glyph: '50' },
  { id: 'hundred', tier: 'gold', glyph: '100' },
  { id: 'streak3', tier: 'bronze', glyph: '3d' },
  { id: 'streak7', tier: 'silver', glyph: '7d' },
  { id: 'streak30', tier: 'gold', glyph: '30d' },
  { id: 'perfect', tier: 'gold', glyph: '10' },
  { id: 'early', tier: 'silver', glyph: 'AM' },
  { id: 'night', tier: 'silver', glyph: 'PM' },
  { id: 'explorer', tier: 'silver', glyph: '5' },
  { id: 'popular', tier: 'gold', glyph: '+5' },
  { id: 'critic', tier: 'bronze', glyph: 'V' },
  { id: 'weekWin', tier: 'silver', glyph: 'W' },
  { id: 'monthWin', tier: 'gold', glyph: 'M' },
];

export interface Player {
  userId: string;
  poops: Poop[];
  count: number;
  points: number;
  avgScore: number | null;
  best: Poop | undefined;
  streak: number;
  votesCast: number;
  upvotes: number;
  downvotes: number;
  weekWins: number;
  monthWins: number;
  badges: Set<string>;
  xp: number;
  level: Level;
}

export function unlockedBadges(p: Omit<Player, 'badges' | 'xp' | 'level'>): Set<string> {
  const b = new Set<string>();
  const hours = p.poops.map((x) => x.at.getHours());
  if (p.count >= 1) b.add('first');
  if (p.count >= 10) b.add('ten');
  if (p.count >= 50) b.add('fifty');
  if (p.count >= 100) b.add('hundred');
  if (p.streak >= 3) b.add('streak3');
  if (p.streak >= 7) b.add('streak7');
  if (p.streak >= 30) b.add('streak30');
  if (p.poops.some((x) => x.type === 4 && x.rating === 5)) b.add('perfect');
  if (hours.some((h) => h >= 4 && h < 7)) b.add('early');
  if (hours.some((h) => h >= 23 || h < 4)) b.add('night');
  if (PLACE_IDS.every((pl) => p.poops.some((x) => x.place === pl))) b.add('explorer');
  if (p.poops.some((x) => netVotes(x) >= 5)) b.add('popular');
  if (p.votesCast >= 20) b.add('critic');
  if (p.weekWins > 0) b.add('weekWin');
  if (p.monthWins > 0) b.add('monthWin');
  return b;
}

// ---- xp & levels ----

export const XP = { perPoop: 10, upvote: 2, downvote: -1, badge: 25, weekWin: 50, monthWin: 150 };

/** Total XP needed to reach each level (index 0 = level 1). */
const LEVELS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000, 4000];

export interface Level {
  level: number;
  /** Index into the level titles (capped at the last one). */
  title: number;
  xpInLevel: number;
  xpForNext: number | null;
}

export function levelFor(xp: number): Level {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]) i++;
  // Past the table, one level per 1200 XP.
  let level = i + 1;
  let floor = LEVELS[i];
  let next: number | null = LEVELS[i + 1] ?? floor + 1200;
  if (i === LEVELS.length - 1) {
    const extra = Math.floor((xp - floor) / 1200);
    level += extra;
    floor += extra * 1200;
    next = floor + 1200;
  }
  return { level, title: i, xpInLevel: xp - floor, xpForNext: next - floor };
}

export const LEVEL_COUNT = LEVELS.length;

/** Everything about every player, computed from all entries. */
export function players(poops: Poop[], userIds: Iterable<string>, now = new Date()): Map<string, Player> {
  const weekly = awards(poops, 'week', now).filter((a) => a.final);
  const monthly = awards(poops, 'month', now).filter((a) => a.final);
  const result = new Map<string, Player>();
  for (const userId of userIds) {
    const mine = poops.filter((p) => p.userId === userId);
    let upvotes = 0;
    let downvotes = 0;
    for (const p of mine)
      for (const v of Object.values(p.votes ?? {})) {
        if (v > 0) upvotes++;
        else downvotes++;
      }
    const votesCast = poops.filter((p) => p.votes && userId in p.votes).length;
    const points = mine.reduce((a, p) => a + score(p), 0);
    const base = {
      userId,
      poops: mine,
      count: mine.length,
      points,
      avgScore: mine.length ? points / mine.length : null,
      best: best(mine),
      streak: longestStreak(mine.map((p) => p.at)),
      votesCast,
      upvotes,
      downvotes,
      weekWins: weekly.filter((a) => a.userId === userId).length,
      monthWins: monthly.filter((a) => a.userId === userId).length,
    };
    const badges = unlockedBadges(base);
    const xp = Math.max(
      0,
      mine.reduce((a, p) => a + XP.perPoop + Math.round(baseScore(p)), 0) +
        upvotes * XP.upvote +
        downvotes * XP.downvote +
        badges.size * XP.badge +
        base.weekWins * XP.weekWin +
        base.monthWins * XP.monthWin,
    );
    result.set(userId, { ...base, badges, xp, level: levelFor(xp) });
  }
  return result;
}

