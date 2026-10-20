import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { subscribeAll } from './data';
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
 * The full history, needed by Top, Stats and profiles. It is only subscribed to once one of
 * those pages is opened (the feed pages through recent entries on its own), then kept live.
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

export function usePoops() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePoops outside provider');
  const { activate } = c;
  useEffect(activate, [activate]);
  return c;
}
