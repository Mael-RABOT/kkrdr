import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMentions, subscribeMentions } from './data';
import { readPref, writePref } from './prefs';
import { useSession } from './session';
import type { Mention } from './types';

/** How many of the newest mentions are kept. */
const SHOWN = 30;
/** Seen ids kept on the device: enough to cover what is shown, with room for deleted ones. */
const KEEP_SEEN = 100;

const keyOf = (m: Mention) => `${m.poopId}/${m.comment.id}`;

/**
 * Ids of the mentions already seen on this device. Ids rather than a time: a phone clock set wrong
 * or a comment edited to tag you later would otherwise be missed.
 */
function readSeen(userId: string): Set<string> {
  try {
    const v = JSON.parse(readPref(`notifSeen:${userId}`) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

interface NotificationsCtx {
  /** Comments tagging you, newest first. null while loading. */
  items: Mention[] | null;
  error: string | null;
  isNew: (m: Mention) => boolean;
  /** How many have not been seen yet. */
  unread: number;
  /** Marks every shown mention as seen, and fetches the list again. */
  markSeen: () => void;
}

const Ctx = createContext<NotificationsCtx | null>(null);

/** Your mentions, kept live at app level so the bell in every page header shares one subscription. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const userId = me?.id;
  const [items, setItems] = useState<Mention[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());

  const fail = useCallback((e: Error) => {
    console.error('notifications', e);
    setError(e.message);
  }, []);

  const refresh = useCallback(() => {
    if (!userId) return;
    fetchMentions(userId, SHOWN).then(
      (m) => {
        setItems(m);
        setError(null);
      },
      // Offline: the live list from the cache stays, it catches up once back online.
      (e: Error & { code?: string }) => e.code !== 'unavailable' && fail(e),
    );
  }, [userId, fail]);

  useEffect(() => {
    if (!userId) return;
    setSeen(readSeen(userId));
    setItems(null);
    setError(null);
    // Live updates, plus a server fetch now: the first snapshot may come from the local cache.
    const stop = subscribeMentions(
      userId,
      SHOWN,
      (m) => {
        setItems(m);
        setError(null);
      },
      fail,
    );
    refresh();
    // An installed app resumes without reloading; its connection may have dropped meanwhile.
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refresh, fail]);

  const isNew = useCallback((m: Mention) => !seen.has(keyOf(m)), [seen]);

  const markSeen = useCallback(() => {
    if (!userId) return;
    refresh();
    if (!items?.length) return;
    // Newest first, so the oldest ids are the ones dropped.
    const next = [...new Set([...items.map(keyOf), ...readSeen(userId)])].slice(0, KEEP_SEEN);
    writePref(`notifSeen:${userId}`, JSON.stringify(next));
    setSeen(new Set(next));
  }, [userId, items, refresh]);

  const unread = items?.filter(isNew).length ?? 0;

  return <Ctx.Provider value={{ items, error, isNew, unread, markSeen }}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNotifications outside provider');
  return c;
}
