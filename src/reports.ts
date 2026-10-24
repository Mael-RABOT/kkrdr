import { dayKey, monthStart, weekStart } from './format';
import type { PeriodKind } from './game';
import { CATEGORIES, type Winners } from './stats';

/**
 * Periods that end after this get a report (no backfill of older history). There is no server:
 * the first client to open the app once a period is over writes it, everyone else reads it.
 */
export const REPORTS_FROM = new Date(2026, 9, 24);

/** Poop points per category won. */
export const POOP_POINTS: Record<PeriodKind, number> = { week: 1, month: 3 };

/** What is stored in reports/{id}. */
export interface ReportData {
  kind: PeriodKind;
  /** Entries in the period. */
  count: number;
  winners: Winners;
  createdBy: string;
  createdAt?: unknown;
}

export interface Report extends Omit<ReportData, 'createdAt'> {
  id: string;
  start: Date;
  end: Date;
}

/** First day of the next period (local midnight, DST-safe). */
export function periodEnd(kind: PeriodKind, start: Date): Date {
  return kind === 'week'
    ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
    : new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

/** week-2026-10-19 (its Monday) or month-2026-10. */
export function reportId(kind: PeriodKind, start: Date): string {
  return kind === 'week' ? `week-${dayKey(start)}` : `month-${dayKey(start).slice(0, 7)}`;
}

/** Starts of the periods that are over and end after `from`, oldest first. */
export function finishedPeriods(kind: PeriodKind, now = new Date(), from = REPORTS_FROM): Date[] {
  const out: Date[] = [];
  for (let s = kind === 'week' ? weekStart(from) : monthStart(from); periodEnd(kind, s) <= now; s = periodEnd(kind, s))
    if (periodEnd(kind, s) > from) out.push(s);
  return out;
}

/** Categories someone won in a report. */
export function categoriesWon(r: Pick<Report, 'winners'>, userId: string): number {
  return CATEGORIES.filter((c) => r.winners[c]?.userIds.includes(userId)).length;
}

/** Poop points: each category won is worth 1 for a week, 3 for a month. */
export function poopPoints(reports: Pick<Report, 'kind' | 'winners'>[], userId: string): number {
  return reports.reduce((a, r) => a + categoriesWon(r, userId) * POOP_POINTS[r.kind], 0);
}
