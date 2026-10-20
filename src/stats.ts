import { dayKey, monthStart, startOfDay, weekStart } from './format';
import { best, rankUsers, score, type TieBreak } from './score';
import type { Place, Poop, Size } from './types';

export type Period = 'week' | 'month' | 'all';

export function periodStart(period: Period, now = new Date()): Date | null {
  if (period === 'all') return null;
  // Calendar periods, the same ones used for poop of the week / month.
  return period === 'week' ? weekStart(now) : monthStart(now);
}

export interface UserStats {
  userId: string;
  count: number;
  perDay: number;
  longestStreak: number;
  maxInDay: number;
  avgRating: number | null;
  points: number;
  avgScore: number;
  /** Leaderboard position (shared only on a full tie). */
  rank: number;
  tie: TieBreak | null;
}

export interface Stats {
  total: number;
  days: number;
  ranking: UserStats[];
  streak: { userId: string; days: number } | null;
  busiestDay: { userId: string; count: number; day: string } | null;
  earliest: { userId: string; at: Date } | null;
  best: Poop | null;
  latest: { userId: string; at: Date } | null;
  hours: number[];
  places: Partial<Record<Place, number>>;
  sizes: Partial<Record<Size, number>>;
  types: number[]; // index 1..7
  avgRating: number | null;
  avgDuration: number | null;
}

const DAY = 86_400_000;

function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

export function longestStreak(dates: Date[]): number {
  const days = [...new Set(dates.map((d) => startOfDay(d).getTime()))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && daysBetween(new Date(days[i - 1]), new Date(days[i])) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

/** All poops are assumed to already be inside the period. */
export function computeStats(poops: Poop[], start: Date | null, now = new Date()): Stats {
  const first = start ?? poops.reduce<Date | null>((m, p) => (!m || p.at < m ? p.at : m), null) ?? now;
  const days = Math.max(1, daysBetween(first, now) + 1);

  const byUser = new Map<string, Poop[]>();
  for (const p of poops) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, []);
    byUser.get(p.userId)!.push(p);
  }

  let busiestDay: Stats['busiestDay'] = null;
  const ranking: UserStats[] = [];
  for (const [userId, list] of byUser) {
    const perDayCount = new Map<string, number>();
    for (const p of list) perDayCount.set(dayKey(p.at), (perDayCount.get(dayKey(p.at)) ?? 0) + 1);
    let maxInDay = 0;
    for (const [day, c] of perDayCount) {
      if (c > maxInDay) maxInDay = c;
      if (!busiestDay || c > busiestDay.count) busiestDay = { userId, count: c, day };
    }
    ranking.push({
      userId,
      count: list.length,
      perDay: list.length / days,
      longestStreak: longestStreak(list.map((p) => p.at)),
      maxInDay,
      avgRating: avg(list.flatMap((p) => (p.rating != null ? [p.rating] : []))),
      points: list.reduce((a, p) => a + score(p), 0),
      avgScore: list.reduce((a, p) => a + score(p), 0) / list.length,
      rank: 0,
      tie: null,
    });
  }
  // Same order and tie rules as the week / month awards.
  const ranked = new Map(rankUsers(poops).map((r, i) => [r.userId, { ...r, i }]));
  for (const r of ranking) Object.assign(r, { rank: ranked.get(r.userId)!.rank, tie: ranked.get(r.userId)!.tie });
  ranking.sort((a, b) => ranked.get(a.userId)!.i - ranked.get(b.userId)!.i);

  const streakLeader = [...ranking].sort((a, b) => b.longestStreak - a.longestStreak)[0];

  let earliest: Stats['earliest'] = null;
  let latest: Stats['latest'] = null;
  const hours = Array<number>(24).fill(0);
  const types = Array<number>(8).fill(0);
  const places: Stats['places'] = {};
  const sizes: Stats['sizes'] = {};
  for (const p of poops) {
    const m = minutesOfDay(p.at);
    if (!earliest || m < minutesOfDay(earliest.at)) earliest = { userId: p.userId, at: p.at };
    if (!latest || m > minutesOfDay(latest.at)) latest = { userId: p.userId, at: p.at };
    hours[p.at.getHours()]++;
    types[p.type]++;
    places[p.place] = (places[p.place] ?? 0) + 1;
    sizes[p.size] = (sizes[p.size] ?? 0) + 1;
  }

  return {
    total: poops.length,
    days,
    ranking,
    streak: streakLeader ? { userId: streakLeader.userId, days: streakLeader.longestStreak } : null,
    busiestDay,
    best: best(poops) ?? null,
    earliest,
    latest,
    hours,
    places,
    sizes,
    types,
    avgRating: avg(poops.flatMap((p) => (p.rating != null ? [p.rating] : []))),
    avgDuration: avg(poops.flatMap((p) => (p.duration != null ? [p.duration] : []))),
  };
}
