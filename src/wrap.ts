import { dayKey, monthStart } from './format';
import { categoriesWon, POOP_POINTS, reportId, type Report } from './reports';
import { best, score } from './score';
import { CATEGORIES, daysBetween, longestStreak, sitTime, type Category } from './stats';
import { COLOR_IDS, PLACE_IDS, SIZE_IDS, type Color, type Place, type Poop, type Size } from './types';

/** How one of my numbers compares to everyone who logged that month (me included). */
export interface Compare {
  mine: number;
  /** Average over the people who logged that month. */
  avg: number;
  /** 1-based; tied values share a rank. */
  rank: number;
  /** People who logged that month. */
  of: number;
  /** Who has the top value (the first one on a tie), and that value. */
  leader: { userId: string; value: number };
}

export type ClockPersona = 'early' | 'morning' | 'lunch' | 'afternoon' | 'evening' | 'night';

export type WrapCard =
  | { id: 'intro' }
  | { id: 'count'; cmp: Compare; prev: number }
  | { id: 'rhythm'; perDay: number; maxInDay: number; maxDay: Date; daysOff: number; days: number }
  | { id: 'streak'; cmp: Compare }
  | { id: 'points'; points: Compare; avgScore: Compare; prev: number }
  | { id: 'best'; poop: Poop }
  | { id: 'worst'; poop: Poop }
  | { id: 'type'; type: number; share: number; types: number[] }
  | { id: 'clock'; hour: number; hours: number[]; earliest: Date; latest: Date; persona: ClockPersona }
  | { id: 'weekday'; day: number; days: number[] }
  | { id: 'places'; place: Place; share: number; kinds: number; workMinutes: number; workCount: number }
  | { id: 'throne'; cmp: Compare; longest: number }
  | { id: 'size'; size: Size; xl: number; perfect: number; rareColor: Color | null }
  | { id: 'social'; up: number; down: number; comments: number; cast: Compare; mostCommented: Poop | null }
  | { id: 'media'; photos: number; gifs: number; sounds: number; soundSecs: number }
  | { id: 'soulmate'; userId: string; times: number }
  | { id: 'trophies'; month: Category[] | null; weeks: number; points: number }
  | { id: 'summary'; count: number; rank: number; of: number; points: number; best: number; sitTime: number; type: number; persona: ClockPersona };

export type WrapCardId = WrapCard['id'];

export interface Wrap {
  month: Date;
  /** My entries that month. */
  count: number;
  /** Always starts with the intro; just the intro when nothing was logged. */
  cards: WrapCard[];
}

/** Two entries this close (either way) count as going "together". */
export const SOULMATE_WINDOW = 30;

const nextMonth = (m: Date) => new Date(m.getFullYear(), m.getMonth() + 1, 1);

/** Start of every finished month I logged in, oldest first. The running month gets no wrap. */
export function wrapMonths(all: Poop[], userId: string, now = new Date()): Date[] {
  const current = monthStart(now);
  const keys = new Set<number>();
  for (const p of all) if (p.userId === userId && p.at < current) keys.add(monthStart(p.at).getTime());
  return [...keys].sort((a, b) => a - b).map((k) => new Date(k));
}

/** Last month: the latest one that is over. */
export function lastMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

/** "2026-10" for a month start, and back. */
export const monthKey = (m: Date) => dayKey(m).slice(0, 7);
export function parseMonthKey(s: string | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})$/);
  if (!m || +m[2] < 1 || +m[2] > 12) return null;
  return new Date(+m[1], +m[2] - 1, 1);
}

/** Rank of my value among everyone's; `lowest` when smaller is better. */
export function compare(values: Map<string, number>, userId: string, lowest = false): Compare {
  const mine = values.get(userId) ?? 0;
  const list = [...values.entries()];
  const better = (a: number, b: number) => (lowest ? a < b : a > b) && Math.abs(a - b) > 1e-9;
  let leader = list[0] ?? [userId, mine];
  for (const e of list) if (better(e[1], leader[1])) leader = e;
  return {
    mine,
    avg: list.length ? list.reduce((a, [, v]) => a + v, 0) / list.length : mine,
    rank: 1 + list.filter(([, v]) => better(v, mine)).length,
    of: Math.max(1, list.length),
    leader: { userId: leader[0], value: leader[1] },
  };
}

function groupBy(poops: Poop[]): Map<string, Poop[]> {
  const m = new Map<string, Poop[]>();
  for (const p of poops) {
    if (!m.has(p.userId)) m.set(p.userId, []);
    m.get(p.userId)!.push(p);
  }
  return m;
}

const mapValues = <T>(m: Map<string, T>, f: (v: T) => number) => new Map([...m].map(([k, v]) => [k, f(v)]));

/** Index of the biggest value; the first one on a tie. */
const argmax = (xs: number[]) => xs.reduce((best, v, i) => (v > xs[best] ? i : best), 0);

export function clockPersona(hour: number): ClockPersona {
  if (hour >= 4 && hour < 9) return 'early';
  if (hour >= 9 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 19) return 'afternoon';
  if (hour >= 19 && hour < 23) return 'evening';
  return 'night';
}

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/**
 * Everything about my month, card by card, each number set against the others who logged that
 * month. Cards with nothing to show are left out.
 */
export function computeWrap(all: Poop[], userId: string, month: Date, reports: Report[] = []): Wrap {
  const start = monthStart(month);
  const end = nextMonth(start);
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const inMonth = all.filter((p) => p.at >= start && p.at < end);
  const prevMine = all.filter((p) => p.userId === userId && p.at >= prevStart && p.at < start);
  const mine = inMonth.filter((p) => p.userId === userId).sort((a, b) => a.at.getTime() - b.at.getTime());
  const wrap: Wrap = { month: start, count: mine.length, cards: [{ id: 'intro' }] };
  if (!mine.length) return wrap;

  const cards = wrap.cards;
  const byUser = groupBy(inMonth);
  const points = (list: Poop[]) => list.reduce((a, p) => a + score(p), 0);

  // Count
  const count = compare(mapValues(byUser, (l) => l.length), userId);
  cards.push({ id: 'count', cmp: count, prev: prevMine.length });

  // Rhythm
  const days = daysBetween(start, end);
  const perDay = new Map<string, number>();
  for (const p of mine) perDay.set(dayKey(p.at), (perDay.get(dayKey(p.at)) ?? 0) + 1);
  let maxDay = mine[0].at;
  let maxInDay = 0;
  for (const p of mine) {
    const c = perDay.get(dayKey(p.at))!;
    if (c > maxInDay) [maxInDay, maxDay] = [c, p.at];
  }
  cards.push({ id: 'rhythm', perDay: mine.length / days, maxInDay, maxDay, daysOff: Math.max(0, days - perDay.size), days });

  // Streak
  cards.push({ id: 'streak', cmp: compare(mapValues(byUser, (l) => longestStreak(l.map((p) => p.at))), userId) });

  // Points
  const myPoints = compare(mapValues(byUser, points), userId);
  cards.push({
    id: 'points',
    points: myPoints,
    avgScore: compare(mapValues(byUser, (l) => points(l) / l.length), userId),
    prev: points(prevMine),
  });

  // Best, and the worst when there is a different one.
  const top = best(mine)!;
  cards.push({ id: 'best', poop: top });
  const worst = mine.reduce((w, p) => (score(p) < score(w) ? p : w));
  if (worst !== top && score(worst) < score(top)) cards.push({ id: 'worst', poop: worst });

  // Texture
  const types = Array<number>(8).fill(0);
  for (const p of mine) types[p.type]++;
  const type = argmax(types);
  cards.push({ id: 'type', type, share: types[type] / mine.length, types });

  // Clock
  const hours = Array<number>(24).fill(0);
  for (const p of mine) hours[p.at.getHours()]++;
  const hour = argmax(hours);
  const byMinute = [...mine].sort((a, b) => minutesOfDay(a.at) - minutesOfDay(b.at));
  cards.push({ id: 'clock', hour, hours, earliest: byMinute[0].at, latest: byMinute[byMinute.length - 1].at, persona: clockPersona(hour) });

  // Weekday, Monday first.
  const weekdays = Array<number>(7).fill(0);
  for (const p of mine) weekdays[(p.at.getDay() + 6) % 7]++;
  cards.push({ id: 'weekday', day: argmax(weekdays), days: weekdays });

  // Places
  const places = PLACE_IDS.map((pl) => mine.filter((p) => p.place === pl).length);
  const work = mine.filter((p) => p.place === 'work');
  const place = argmax(places);
  cards.push({
    id: 'places',
    place: PLACE_IDS[place],
    share: places[place] / mine.length,
    kinds: places.filter((n) => n > 0).length,
    workMinutes: sitTime(work),
    workCount: work.length,
  });

  // Throne time, only if some durations were logged.
  if (sitTime(mine) > 0)
    cards.push({ id: 'throne', cmp: compare(mapValues(byUser, sitTime), userId), longest: Math.max(...mine.map((p) => p.duration ?? 0)) });

  // Size and colour
  const sizes = SIZE_IDS.map((s) => mine.filter((p) => p.size === s).length);
  const colors = COLOR_IDS.map((c) => mine.filter((p) => p.color === c).length);
  const rare = colors.reduce<number>((r, n, i) => (n > 0 && (r < 0 || n < colors[r]) ? i : r), -1);
  cards.push({
    id: 'size',
    size: SIZE_IDS[argmax(sizes)],
    xl: sizes[SIZE_IDS.indexOf('XL')],
    perfect: mine.filter((p) => p.perfect).length,
    rareColor: rare >= 0 ? COLOR_IDS[rare] : null,
  });

  // Social: votes on my entries, comments on them, and the votes I gave that month.
  let up = 0;
  let down = 0;
  for (const p of mine)
    for (const [voter, v] of Object.entries(p.votes ?? {}))
      if (voter !== userId) {
        if (v > 0) up++;
        else down++;
      }
  const comments = mine.reduce((a, p) => a + (p.commentCount ?? 0), 0);
  const castBy = new Map([...byUser.keys()].map((u) => [u, 0]));
  for (const p of inMonth) for (const voter of Object.keys(p.votes ?? {})) if (voter !== p.userId && castBy.has(voter)) castBy.set(voter, castBy.get(voter)! + 1);
  const cast = compare(castBy, userId);
  const mostCommented = mine.reduce<Poop | null>((m, p) => ((p.commentCount ?? 0) > (m?.commentCount ?? 0) ? p : m), null);
  if (up || down || comments || cast.mine) cards.push({ id: 'social', up, down, comments, cast, mostCommented });

  // Media
  const photos = mine.filter((p) => p.photo).length;
  const gifs = mine.filter((p) => p.gif).length;
  const withSound = mine.filter((p) => p.sound);
  if (photos || gifs || withSound.length)
    cards.push({ id: 'media', photos, gifs, sounds: withSound.length, soundSecs: Math.round(withSound.reduce((a, p) => a + p.sound!.secs, 0)) });

  // Soulmate: who most often went within the window of one of mine.
  const window = SOULMATE_WINDOW * 60_000;
  let soul: { userId: string; times: number } | null = null;
  for (const [other, list] of byUser) {
    if (other === userId) continue;
    const times = mine.filter((p) => list.some((q) => Math.abs(q.at.getTime() - p.at.getTime()) <= window)).length;
    if (times && (!soul || times > soul.times)) soul = { userId: other, times };
  }
  if (soul) cards.push({ id: 'soulmate', ...soul });

  // Trophies: the month report, and the weeks starting in the month.
  const monthReport = reports.find((r) => r.id === reportId('month', start));
  const weekReports = reports.filter((r) => r.kind === 'week' && r.start >= start && r.start < end);
  const monthCats = monthReport ? CATEGORIES.filter((c) => monthReport.winners[c]?.userIds.includes(userId)) : null;
  const weeks = weekReports.reduce((a, r) => a + categoriesWon(r, userId), 0);
  if (monthReport || weekReports.length)
    cards.push({ id: 'trophies', month: monthCats, weeks, points: (monthCats?.length ?? 0) * POOP_POINTS.month + weeks * POOP_POINTS.week });

  cards.push({
    id: 'summary',
    count: mine.length,
    rank: myPoints.rank,
    of: myPoints.of,
    points: myPoints.mine,
    best: score(top),
    sitTime: sitTime(mine),
    type,
    persona: clockPersona(hour),
  });
  return wrap;
}
