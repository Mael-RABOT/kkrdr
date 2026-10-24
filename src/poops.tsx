import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { subscribeAll } from './data';
import { useFeed } from './feed';
import { players, type Player } from './game';
import { useSession } from './session';
import type { Poop } from './types';

interface PoopsCtx {
  /** All entries, newest first. null while loading. */
  poops: Poop[] | null;
  error: string | null;
  players: Map<string, Player>;
  activate: () => void;
}

const Ctx = createContext<PoopsCtx | null>(null);

/**
 * The full history, needed by Stats (all time), profiles, Top's older winners and Admin. It is
 * subscribed to once one of those pages is opened, then kept live.
 */
export function PoopsProvider({ children }: { children: ReactNode }) {
  const { users } = useSession();
  const [active, setActive] = useState(false);
  const [poops, setPoops] = useState<Poop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => (active ? subscribeAll(setPoops, (e) => setError(e.message)) : undefined), [active]);

  const all = useMemo(() => players(poops ?? [], users.keys()), [poops, users]);
  const activate = useMemo(() => () => setActive(true), []);

  return <Ctx.Provider value={{ poops, error, players: all, activate }}>{children}</Ctx.Provider>;
}

/** Entries changed on this device and not synced yet, among those loaded (the feed's, or the full history). */
export function usePendingCount() {
  const c = useContext(Ctx);
  const { poops: feed } = useFeed();
  return useMemo(() => {
    const ids = new Set<string>();
    for (const p of [...(c?.poops ?? []), ...(feed ?? [])]) if (p.pending) ids.add(p.id);
    return ids.size;
  }, [c?.poops, feed]);
}

/** The full history. It starts loading the first time a page needs it (`needed`, by default). */
export function usePoops(needed = true) {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePoops outside provider');
  const { activate } = c;
  useEffect(() => {
    if (needed) activate();
  }, [needed, activate]);
  return c;
}
