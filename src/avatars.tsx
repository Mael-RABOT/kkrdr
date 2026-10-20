import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchAvatar, subscribeAvatars } from './data';

interface AvatarsCtx {
  avatars: Map<string, string>;
  /** Reloads one picture from the server (after uploading it). */
  refresh: (userId: string) => Promise<void>;
}

const Ctx = createContext<AvatarsCtx>({ avatars: new Map(), refresh: async () => {} });

/** Profile pictures by user id (data URLs). Mounted once signed in. */
export function AvatarsProvider({ children }: { children: ReactNode }) {
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  useEffect(() => subscribeAvatars(setAvatars, () => {}), []);

  const refresh = useCallback(async (userId: string) => {
    const url = await fetchAvatar(userId);
    setAvatars((m) => {
      const next = new Map(m);
      if (url) next.set(userId, url);
      else next.delete(userId);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ avatars, refresh }}>{children}</Ctx.Provider>;
}

export function useAvatar(userId: string): string | undefined {
  return useContext(Ctx).avatars.get(userId);
}

export function useRefreshAvatar() {
  return useContext(Ctx).refresh;
}
