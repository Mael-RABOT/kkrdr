import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeRecent, subscribeSince, type FeedSort } from './data';
import { weekStart } from './game';
import { readLocal, writeLocal } from './localCache';
import { readPref, writePref } from './prefs';
import type { Poop } from './types';

export const PAGE = 20;
const CACHE = 'feed-cache';

interface FeedCtx {
  sort: FeedSort;
  setSort: (s: FeedSort) => void;
  /** Newest `limit` entries, newest first. null while loading. */
  poops: Poop[] | null;
  /** This week's entries, for the leader banner. */
  week: Poop[] | null;
  error: string | null;
  limit: number;
  more: () => void;
}

const Ctx = createContext<FeedCtx | null>(null);

type CachedPoop = Omit<Poop, 'at' | 'createdAt'> & { at: string; createdAt?: string };

/** First page saved from the last server snapshot, so the feed shows up before Firestore has opened. */
function readCache(sort: FeedSort): Poop[] | null {
  const c = readLocal<{ sort: FeedSort; poops: CachedPoop[] }>(CACHE);
  if (c?.sort !== sort || !Array.isArray(c.poops)) return null;
  return c.poops.map((p) => ({ ...p, at: new Date(p.at), createdAt: p.createdAt ? new Date(p.createdAt) : undefined }));
}

/**
 * The feed's live data, kept at app level: going back to the feed shows it at once, at the same
 * scroll depth and sort, instead of subscribing again.
 */
export function FeedProvider({ children }: { children: ReactNode }) {
  const [sort, setSortState] = useState<FeedSort>(() => (readPref('feedSort') === 'createdAt' ? 'createdAt' : 'at'));
  const [limit, setLimit] = useState(PAGE);
  const [poops, setPoops] = useState<Poop[] | null>(() => readCache(sort));
  const [week, setWeek] = useState<Poop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Newest `limit` entries; the limit grows as you scroll (already loaded ones come from the local cache).
  useEffect(
    () =>
      subscribeRecent(
        limit,
        sort,
        (list, fromServer) => {
          setPoops(list);
          setError(null);
          if (fromServer) writeLocal(CACHE, { sort, poops: list.slice(0, PAGE) });
        },
        (e) => setError(e.message),
      ),
    [limit, sort],
  );
  // The provider outlives a page visit, so move to the new week when the app comes back on a Monday.
  const [weekFrom, setWeekFrom] = useState(() => weekStart(new Date()).getTime());
  useEffect(() => {
    const check = () => document.visibilityState === 'visible' && setWeekFrom(weekStart(new Date()).getTime());
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  useEffect(() => subscribeSince(new Date(weekFrom), setWeek, () => {}), [weekFrom]);

  const setSort = useCallback(
    (v: FeedSort) => {
      if (v === sort) return;
      writePref('feedSort', v);
      setSortState(v);
      setLimit(PAGE);
      setPoops(readCache(v));
    },
    [sort],
  );

  const more = useCallback(() => setLimit((n) => n + PAGE), []);

  return <Ctx.Provider value={{ sort, setSort, poops, week, error, limit, more }}>{children}</Ctx.Provider>;
}

export function useFeed() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFeed outside provider');
  return c;
}
