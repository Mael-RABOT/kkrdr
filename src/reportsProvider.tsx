import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createReport, fetchPeriod, subscribeReports } from './data';
import type { PeriodKind } from './game';
import { finishedPeriods, periodEnd, reportId, type Report } from './reports';
import { useSession } from './session';
import { periodWinners } from './stats';
import { useOnline } from './useOnline';

/** Every report, newest first. null while loading. */
const Ctx = createContext<Report[] | null>(null);

/**
 * Week / month reports, kept live. Once the list is known from the server, any finished period
 * without a report gets one written by this client.
 */
export function ReportsProvider({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const online = useOnline();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [complete, setComplete] = useState(false);
  const running = useRef(false);

  useEffect(
    () =>
      subscribeReports(
        (list, fromServer) => {
          setReports(list.sort((a, b) => b.start.getTime() - a.start.getTime()));
          if (fromServer) setComplete(true);
        },
        () => {},
      ),
    [],
  );

  // Check again when the app comes back, e.g. on a Monday after a weekend in the background.
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const check = () => document.visibilityState === 'visible' && setVisible((n) => n + 1);
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  useEffect(() => {
    if (!complete || !online || !me || !reports || running.current) return;
    const have = new Set(reports.map((r) => r.id));
    const missing = (['week', 'month'] as PeriodKind[]).flatMap((kind) =>
      finishedPeriods(kind)
        .filter((s) => !have.has(reportId(kind, s)))
        .map((start) => ({ kind, start })),
    );
    if (!missing.length) return;
    running.current = true;
    (async () => {
      for (const { kind, start } of missing) {
        const end = periodEnd(kind, start);
        const list = await fetchPeriod(start, end);
        await createReport(reportId(kind, start), { kind, start, end, count: list.length, winners: periodWinners(list), createdBy: me.id });
      }
    })()
      // Another client may have been faster, or the connection dropped: the next check retries.
      .catch(() => {})
      .finally(() => (running.current = false));
  }, [complete, online, me, reports, visible]);

  return <Ctx.Provider value={reports}>{children}</Ctx.Provider>;
}

export function useReports() {
  return useContext(Ctx);
}
