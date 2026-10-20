import { describe, expect, it } from 'vitest';
import { computeStats, longestStreak, periodStart } from './stats';
import type { Poop } from './types';

const d = (s: string) => new Date(s);
let n = 0;
const poop = (userId: string, at: string, extra: Partial<Poop> = {}): Poop => ({
  id: String(n++),
  userId,
  at: d(at),
  type: 4,
  size: 'M',
  place: 'home',
  ...extra,
});

describe('longestStreak', () => {
  it('counts consecutive days, ignoring duplicates within a day', () => {
    expect(longestStreak([])).toBe(0);
    expect(
      longestStreak([d('2026-10-01T08:00'), d('2026-10-01T20:00'), d('2026-10-02T09:00'), d('2026-10-03T09:00'), d('2026-10-05T09:00')]),
    ).toBe(3);
  });

  it('works across a DST change', () => {
    expect(longestStreak([d('2026-10-24T12:00'), d('2026-10-25T12:00'), d('2026-10-26T12:00')])).toBe(3);
  });
});

describe('periodStart', () => {
  it('uses the calendar week (from Monday) and month', () => {
    expect(periodStart('week', d('2026-10-20T15:30'))).toEqual(d('2026-10-19T00:00'));
    expect(periodStart('month', d('2026-10-20T15:30'))).toEqual(d('2026-10-01T00:00'));
    expect(periodStart('all')).toBeNull();
  });
});

describe('computeStats', () => {
  const now = d('2026-10-20T22:00');
  const poops = [
    poop('a', '2026-10-18T07:00', { rating: 4, place: 'work' }),
    poop('a', '2026-10-19T08:00', { rating: 2 }),
    poop('a', '2026-10-19T23:30'),
    poop('b', '2026-10-20T05:15', { duration: 10 }),
  ];
  const s = computeStats(poops, null, now);

  it('ranks users by count with per-day averages over the span since the first entry', () => {
    expect(s.days).toBe(3);
    expect(s.ranking.map((r) => [r.userId, r.count])).toEqual([['a', 3], ['b', 1]]);
    expect(s.ranking[0].perDay).toBeCloseTo(1);
    expect(s.ranking[0].longestStreak).toBe(2);
    expect(s.ranking[0].maxInDay).toBe(2);
    expect(s.ranking[0].avgRating).toBe(3);
  });

  it('finds records and distributions', () => {
    expect(s.busiestDay).toEqual({ userId: 'a', count: 2, day: '2026-10-19' });
    expect(s.earliest?.userId).toBe('b');
    expect(s.latest?.at).toEqual(d('2026-10-19T23:30'));
    expect(s.hours[7]).toBe(1);
    expect(s.places).toEqual({ work: 1, home: 3 });
    expect(s.types[4]).toBe(4);
    expect(s.avgDuration).toBe(10);
  });

  it('handles an empty period', () => {
    const e = computeStats([], periodStart('week', now), now);
    expect(e.total).toBe(0);
    expect(e.days).toBe(2); // Monday 19 to Tuesday 20
    expect(e.streak).toBeNull();
  });
});
