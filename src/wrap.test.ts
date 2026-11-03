import { describe, expect, it } from 'vitest';
import type { Report } from './reports';
import type { Poop } from './types';
import { clockPersona, compare, computeWrap, lastMonth, monthKey, parseMonthKey, wrapMonths, type WrapCard } from './wrap';

let n = 0;
const poop = (userId: string, at: string, extra: Partial<Poop> = {}): Poop => ({
  id: String(n++),
  userId,
  at: new Date(at),
  type: 4,
  size: 'M',
  place: 'home',
  ...extra,
});

const OCT = new Date(2026, 9, 1);
const NOW = new Date(2026, 10, 3);
const card = <K extends WrapCard['id']>(cards: WrapCard[], id: K) => cards.find((c) => c.id === id) as Extract<WrapCard, { id: K }> | undefined;

describe('compare', () => {
  it('ranks, averages and finds the leader', () => {
    const c = compare(new Map([['a', 3], ['b', 5], ['c', 1]]), 'a');
    expect(c).toEqual({ mine: 3, avg: 3, rank: 2, of: 3, leader: { userId: 'b', value: 5 } });
  });

  it('shares ranks on ties and supports lowest-wins', () => {
    expect(compare(new Map([['a', 5], ['b', 5]]), 'b').rank).toBe(1);
    expect(compare(new Map([['a', 2], ['b', 5]]), 'b', true).rank).toBe(2);
  });
});

describe('month keys', () => {
  it('round-trips and rejects junk', () => {
    expect(monthKey(OCT)).toBe('2026-10');
    expect(parseMonthKey('2026-10')).toEqual(OCT);
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('nope')).toBeNull();
    expect(parseMonthKey(undefined)).toBeNull();
  });

  it('lists the finished months I logged in, oldest first', () => {
    const all = [
      poop('a', '2026-10-05T09:00'),
      poop('a', '2026-08-01T09:00'),
      poop('b', '2026-09-01T09:00'),
      poop('a', '2026-10-20T09:00'),
      poop('a', '2026-11-02T09:00'), // the running month: no wrap yet
    ];
    expect(wrapMonths(all, 'a', NOW).map(monthKey)).toEqual(['2026-08', '2026-10']);
  });
});

describe('lastMonth', () => {
  it('is the month before, across a year change', () => {
    expect(lastMonth(NOW)).toEqual(OCT);
    expect(lastMonth(new Date(2027, 0, 15))).toEqual(new Date(2026, 11, 1));
  });
});

describe('clockPersona', () => {
  it('maps hours to a persona', () => {
    expect(clockPersona(6)).toBe('early');
    expect(clockPersona(10)).toBe('morning');
    expect(clockPersona(13)).toBe('lunch');
    expect(clockPersona(17)).toBe('afternoon');
    expect(clockPersona(21)).toBe('evening');
    expect(clockPersona(23)).toBe('night');
    expect(clockPersona(2)).toBe('night');
  });
});

describe('computeWrap', () => {
  it('is just the intro when nothing was logged', () => {
    const w = computeWrap([poop('b', '2026-10-05T09:00')], 'a', OCT);
    expect(w.count).toBe(0);
    expect(w.cards.map((c) => c.id)).toEqual(['intro']);
  });

  it('keeps only the month, including its edges across DST', () => {
    const all = [
      poop('a', '2026-09-30T23:59'),
      poop('a', '2026-10-01T00:00'),
      poop('a', '2026-10-25T03:30'), // DST change in Europe
      poop('a', '2026-10-31T23:59'),
      poop('a', '2026-11-01T00:00'),
    ];
    const w = computeWrap(all, 'a', OCT);
    expect(w.count).toBe(3);
    expect(card(w.cards, 'rhythm')).toMatchObject({ days: 31, daysOff: 28 });
    expect(card(w.cards, 'count')!.prev).toBe(1);
  });

  it('compares with the others and the previous month', () => {
    const all = [
      poop('a', '2026-10-01T08:00', { rating: 5 }),
      poop('a', '2026-10-02T08:00', { rating: 5 }),
      poop('a', '2026-10-03T08:00', { rating: 1, type: 7 }),
      poop('b', '2026-10-01T08:10'),
      poop('a', '2026-09-10T08:00'),
    ];
    const w = computeWrap(all, 'a', OCT);
    const count = card(w.cards, 'count')!;
    expect(count.cmp).toMatchObject({ mine: 3, avg: 2, rank: 1, of: 2 });
    expect(count.prev).toBe(1);
    expect(card(w.cards, 'streak')!.cmp.mine).toBe(3);
    expect(card(w.cards, 'worst')!.poop.type).toBe(7);
    expect(card(w.cards, 'type')).toMatchObject({ type: 4 });
    expect(card(w.cards, 'clock')).toMatchObject({ hour: 8, persona: 'early' });
    expect(card(w.cards, 'weekday')!.day).toBe(3); // Thursday Oct 1st
    expect(card(w.cards, 'summary')).toMatchObject({ count: 3, rank: 1, of: 2 });
  });

  it('leaves out cards with nothing to show', () => {
    const w = computeWrap([poop('a', '2026-10-01T08:00')], 'a', OCT);
    const ids = w.cards.map((c) => c.id);
    for (const id of ['worst', 'throne', 'social', 'media', 'soulmate', 'trophies'] as const) expect(ids).not.toContain(id);
    expect(ids[0]).toBe('intro');
    expect(ids[ids.length - 1]).toBe('summary');
  });

  it('counts social, media and throne time', () => {
    const all = [
      poop('a', '2026-10-01T08:00', { votes: { b: 1, c: -1, a: 1 }, commentCount: 4, duration: 12, photo: 1, place: 'work' }),
      poop('a', '2026-10-02T08:00', { sound: { v: 1, secs: 4.4 }, duration: 3, commentCount: 1 }),
      poop('b', '2026-10-01T09:00', { votes: { a: 1 }, duration: 30 }),
    ];
    const w = computeWrap(all, 'a', OCT);
    expect(card(w.cards, 'social')).toMatchObject({ up: 1, down: 1, comments: 5 });
    expect(card(w.cards, 'social')!.cast.mine).toBe(1);
    expect(card(w.cards, 'social')!.mostCommented!.commentCount).toBe(4);
    expect(card(w.cards, 'media')).toEqual({ id: 'media', photos: 1, gifs: 0, sounds: 1, soundSecs: 4 });
    expect(card(w.cards, 'throne')).toMatchObject({ longest: 12, cmp: { mine: 15, rank: 2 } });
    expect(card(w.cards, 'places')).toMatchObject({ workMinutes: 12, workCount: 1, kinds: 2 });
  });

  it('finds the soulmate within the window only', () => {
    const all = [
      poop('a', '2026-10-01T08:00'),
      poop('a', '2026-10-02T08:00'),
      poop('b', '2026-10-01T08:30'),
      poop('c', '2026-10-01T07:45'),
      poop('c', '2026-10-02T08:20'),
      poop('d', '2026-10-02T09:00'),
    ];
    expect(card(computeWrap(all, 'a', OCT).cards, 'soulmate')).toEqual({ id: 'soulmate', userId: 'c', times: 2 });
  });

  it('adds trophies from the month and its weeks', () => {
    const reports = [
      { id: 'month-2026-10', kind: 'month', winners: { points: { userIds: ['a'], value: 9 }, streak: { userIds: ['a', 'b'], value: 3 } } },
      { id: 'week-2026-10-05', kind: 'week', start: new Date(2026, 9, 5), winners: { best: { userIds: ['a'], value: 10 } } },
      { id: 'week-2026-09-28', kind: 'week', start: new Date(2026, 8, 28), winners: { best: { userIds: ['a'], value: 10 } } },
    ] as unknown as Report[];
    const w = computeWrap([poop('a', '2026-10-06T08:00')], 'a', OCT, reports);
    expect(card(w.cards, 'trophies')).toEqual({ id: 'trophies', month: ['points', 'streak'], weeks: 1, points: 7 });
  });
});
