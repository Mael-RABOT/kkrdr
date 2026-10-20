import { describe, expect, it } from 'vitest';
import { awards, baseScore, levelFor, players, score, textureFactor, weekStart } from './game';
import type { Poop } from './types';

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

describe('score', () => {
  it('rewards smooth texture times rating, plus votes', () => {
    expect(textureFactor(4)).toBe(1);
    expect(textureFactor(3)).toBe(0.75);
    expect(textureFactor(7)).toBe(0.25);
    expect(baseScore({ type: 4, rating: 4 })).toBe(8);
    expect(baseScore({ type: 6, rating: 5 })).toBe(5);
    expect(baseScore({ type: 4 })).toBe(6); // unrated counts as 3
    expect(score({ type: 4, rating: 4, votes: { a: 1, b: 1, c: -1 } })).toBe(9);
  });
});

describe('awards', () => {
  const now = new Date('2026-10-21T12:00'); // Wednesday
  const data = [
    poop('a', '2026-10-06T08:00', { rating: 5 }), // week of Oct 5: a wins (10)
    poop('b', '2026-10-07T08:00', { rating: 4 }), // 8
    poop('b', '2026-10-13T08:00', { rating: 3, votes: { a: 1, c: 1, d: 1 } }), // week of Oct 12: b wins (9)
    poop('a', '2026-10-14T08:00', { type: 6, rating: 5 }), // 5
    poop('a', '2026-10-20T08:00', { rating: 2 }), // current week, running
  ];

  it('weeks start on Monday', () => {
    expect(weekStart(new Date('2026-10-18T23:00'))).toEqual(new Date('2026-10-12T00:00'));
    expect(weekStart(new Date('2026-10-19T00:30'))).toEqual(new Date('2026-10-19T00:00'));
  });

  it('gives each week to the person with the most points, newest first, current week not final', () => {
    const w = awards(data, 'week', now);
    expect(w.map((a) => [a.start.getDate(), a.userId, a.points, a.final])).toEqual([
      [19, 'a', 4, false],
      [12, 'b', 9, true], // b 9 vs a 5
      [5, 'a', 10, true], // a 10 vs b 8
    ]);
  });

  it('counts total points, not the single best poop', () => {
    const many = [
      poop('a', '2026-10-13T08:00', { rating: 5 }), // a: one great poop, 10
      poop('b', '2026-10-13T09:00', { rating: 3 }), // b: two ok ones, 6 + 6 = 12
      poop('b', '2026-10-14T09:00', { rating: 3 }),
    ];
    const [week] = awards(many, 'week', now);
    expect([week.userId, week.points, week.count, score(week.poop)]).toEqual(['b', 12, 2, 6]);
  });

  it('feeds wins, badges and xp into players', () => {
    const p = players(data, ['a', 'b'], now);
    expect(p.get('a')!.weekWins).toBe(1);
    expect(p.get('b')!.weekWins).toBe(1);
    expect(p.get('a')!.badges.has('perfect')).toBe(true);
    expect(p.get('a')!.badges.has('weekWin')).toBe(true);
    expect(p.get('b')!.upvotes).toBe(3);
    expect(p.get('a')!.votesCast).toBe(1);
    // b: 2 poops (10+8, 10+6) + 3 upvotes*2 + badges(first, weekWin)*25 + 1 week win*50
    expect(p.get('b')!.xp).toBe(18 + 16 + 6 + 50 + 50);
  });
});

describe('levels', () => {
  it('maps xp to levels with progress', () => {
    expect(levelFor(0)).toEqual({ level: 1, title: 0, xpInLevel: 0, xpForNext: 50 });
    expect(levelFor(160)).toEqual({ level: 3, title: 2, xpInLevel: 10, xpForNext: 150 });
    expect(levelFor(4000).level).toBe(11);
    expect(levelFor(6500)).toMatchObject({ level: 13, title: 10, xpInLevel: 100, xpForNext: 1200 });
  });
});
