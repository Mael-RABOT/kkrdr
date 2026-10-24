import { describe, expect, it } from 'vitest';
import { categoriesWon, finishedPeriods, periodEnd, poopPoints, reportId } from './reports';
import { periodWinners } from './stats';
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

describe('periodWinners', () => {
  it('names a winner per category and shares ties', () => {
    const w = periodWinners([
      poop('a', '2026-10-19T06:00', { rating: 5, duration: 10 }),
      poop('b', '2026-10-19T06:00', { rating: 5 }),
      poop('b', '2026-10-20T23:30', { rating: 3 }),
    ]);
    expect(w.points).toEqual({ userIds: ['b'], value: 16 });
    expect(w.best?.userIds).toEqual(['a', 'b']);
    expect(w.best?.poopId).toBeDefined();
    expect(w.streak).toEqual({ userIds: ['b'], value: 2 });
    expect(w.busiestDay?.userIds.sort()).toEqual(['a', 'b']);
    expect(w.earliest).toEqual({ userIds: ['a', 'b'], value: 360 });
    expect(w.latest).toEqual({ userIds: ['b'], value: 23 * 60 + 30 });
    expect(w.sitter).toEqual({ userIds: ['a'], value: 10 });
  });

  it('leaves out categories nobody qualifies for', () => {
    expect(periodWinners([])).toEqual({});
    expect(periodWinners([poop('a', '2026-10-19T08:00')]).sitter).toBeUndefined();
  });
});

describe('poop points', () => {
  const week = { kind: 'week' as const, winners: { points: { userIds: ['a', 'b'], value: 1 }, best: { userIds: ['a'], value: 1 } } };
  const month = { kind: 'month' as const, winners: { streak: { userIds: ['a'], value: 3 } } };

  it('gives 1 per category won in a week, 3 in a month', () => {
    expect(categoriesWon(week, 'a')).toBe(2);
    expect(poopPoints([week, month], 'a')).toBe(5);
    expect(poopPoints([week, month], 'b')).toBe(1);
    expect(poopPoints([week, month], 'c')).toBe(0);
  });
});

describe('periods', () => {
  it('names reports by their first day', () => {
    expect(reportId('week', d('2026-10-19T00:00'))).toBe('week-2026-10-19');
    expect(reportId('month', d('2026-10-01T00:00'))).toBe('month-2026-10');
  });

  it('ends at local midnight across a DST change', () => {
    // Europe switches back on Sunday Oct 25 2026.
    expect(periodEnd('week', d('2026-10-19T00:00'))).toEqual(d('2026-10-26T00:00'));
    expect(periodEnd('month', d('2026-10-01T00:00'))).toEqual(d('2026-11-01T00:00'));
  });

  it('lists the finished periods that end after the cut-off', () => {
    const from = d('2026-10-24T00:00');
    expect(finishedPeriods('week', d('2026-10-25T12:00'), from)).toEqual([]);
    expect(finishedPeriods('week', d('2026-10-26T00:00'), from)).toEqual([d('2026-10-19T00:00')]);
    expect(finishedPeriods('week', d('2026-11-03T08:00'), from)).toEqual([d('2026-10-19T00:00'), d('2026-10-26T00:00')]);
    expect(finishedPeriods('month', d('2026-10-31T23:59'), from)).toEqual([]);
    expect(finishedPeriods('month', d('2026-11-01T00:00'), from)).toEqual([d('2026-10-01T00:00')]);
  });
});
