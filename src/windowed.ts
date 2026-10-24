import { useCallback, useEffect, useRef, useState } from 'react';
import { newestBefore, subscribeFrom, type FeedSort } from './data';
import { startOfDay } from './format';
import type { Poop } from './types';

/** Start of a window that ends with the day of `d`: that day and the one before, never before `bound`. */
function windowStart(d: Date, bound: Date | null | undefined): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - 1);
  return bound && bound > s ? bound : s;
}

interface Options {
  /** Never load entries before this (e.g. the start of the Stats period). */
  bound?: Date | null;
  /** What to show before the first snapshot. */
  initial?: () => Poop[] | null;
  /** Called with each list confirmed by the server. */
  onServer?: (p: Poop[]) => void;
}

/**
 * The newest entries by `sort`, two days at a time, live. `more()` reaches back to the next older
 * day that has entries (plus one), so days with nothing are skipped in one step.
 */
export function useWindowed(sort: FeedSort, { bound, initial, onServer }: Options = {}) {
  const key = `${sort}|${bound?.getTime() ?? ''}`;
  const [state, setState] = useState(() => ({ key, from: windowStart(new Date(), bound), poops: initial?.() ?? null }));
  // Another sort or bound: start again from the newest two days.
  if (state.key !== key) setState({ key, from: windowStart(new Date(), bound), poops: initial?.() ?? null });
  const { from, poops } = state;
  const [older, setOlder] = useState<Date | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const serverCb = useRef(onServer);
  serverCb.current = onServer;

  useEffect(
    () =>
      subscribeFrom(
        from,
        sort,
        (list, fromServer) => {
          setState((s) => (s.from === from ? { ...s, poops: list } : s));
          setError(null);
          if (fromServer) serverCb.current?.(list);
        },
        (e) => setError(e.message),
      ),
    [from, sort],
  );

  // When the newest entry before the window happened, to know if there is more and where to go.
  useEffect(() => {
    let live = true;
    setOlder(undefined);
    newestBefore(from, sort).then(
      (p) => live && setOlder(p ? (sort === 'createdAt' ? (p.createdAt ?? p.at) : p.at) : null),
      () => live && setOlder(null),
    );
    return () => {
      live = false;
    };
  }, [from, sort]);

  const hasMore = !!older && (!bound || older >= bound);
  const more = useCallback(() => {
    if (older) setState((s) => ({ ...s, from: windowStart(older, bound) }));
  }, [older, bound]);

  // checking: not known yet whether there is anything older.
  return { poops, error, hasMore, more, checking: older === undefined };
}
