import { describe, expect, it } from 'vitest';
import { timeline } from './timeline';
import type { Poop } from './types';

let n = 0;
const poop = (at: string): Poop => ({ id: String(n++), userId: 'a', at: new Date(at), type: 4, size: 'M', place: 'home' });

const shape = (items: ReturnType<typeof timeline>['items']) =>
  items.map((i) => (i.kind === 'gap' ? `gap ${i.days}` : `${i.date.getDate()}: ${i.poops.map((p) => p.at.getHours()).join(',')}`));

describe('timeline', () => {
  const poops = [
    poop('2026-10-15T12:00'),
    poop('2026-10-20T08:00'),
    poop('2026-10-18T22:00'),
    poop('2026-10-20T19:00'),
    poop('2026-10-15T18:00'),
    poop('2026-10-19T07:00'),
  ];

  it('groups by day, newest first, with gaps for skipped days', () => {
    expect(shape(timeline(poops, 10).items)).toEqual(['20: 19,8', '19: 7', '18: 22', 'gap 2', '15: 18,12']);
    expect(timeline(poops, 10).hasMore).toBe(false);
  });

  it('pages by active days', () => {
    const t = timeline(poops, 3);
    expect(shape(t.items)).toEqual(['20: 19,8', '19: 7', '18: 22']);
    expect(t.hasMore).toBe(true);
  });

  it('counts gaps in calendar days across a DST change', () => {
    // Clocks go back on Oct 25 2026 in Europe.
    expect(shape(timeline([poop('2026-10-24T23:30'), poop('2026-10-27T00:30')], 5).items)).toEqual(['27: 0', 'gap 2', '24: 23']);
  });

  it('is empty without entries', () => {
    expect(timeline([], 14)).toEqual({ items: [], hasMore: false });
  });
});
