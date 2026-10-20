import { dayKey, startOfDay } from './format';
import { daysBetween } from './stats';
import type { Poop } from './types';

export type TimelineItem = { kind: 'day'; date: Date; poops: Poop[] } | { kind: 'gap'; days: number };

/**
 * A person's history for the profile timeline: the newest `activeDays` days with entries,
 * newest first (also within a day), with a gap item wherever whole days were skipped.
 */
export function timeline(poops: Poop[], activeDays: number): { items: TimelineItem[]; hasMore: boolean } {
  const sorted = [...poops].sort((a, b) => b.at.getTime() - a.at.getTime());
  const days: { date: Date; poops: Poop[] }[] = [];
  for (const p of sorted) {
    const last = days[days.length - 1];
    if (last && dayKey(last.date) === dayKey(p.at)) last.poops.push(p);
    else days.push({ date: startOfDay(p.at), poops: [p] });
  }

  const items: TimelineItem[] = [];
  const shown = days.slice(0, activeDays);
  shown.forEach((d, i) => {
    const prev = shown[i - 1];
    // prev is the newer day: more than one calendar day apart means days off in between.
    if (prev) {
      const off = daysBetween(d.date, prev.date) - 1;
      if (off > 0) items.push({ kind: 'gap', days: off });
    }
    items.push({ kind: 'day', ...d });
  });
  return { items, hasMore: days.length > activeDays };
}
