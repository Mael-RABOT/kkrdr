import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeTitles } from './data';
import { titleById, type TitleDef, type Wardrobe } from './shop';

/** Everyone's titles by user id. Empty while loading. */
const Ctx = createContext<Map<string, Wardrobe>>(new Map());

/** The titles everyone bought in the shop, kept live. */
export function TitlesProvider({ children }: { children: ReactNode }) {
  const [titles, setTitles] = useState<Map<string, Wardrobe>>(new Map());
  useEffect(() => subscribeTitles(setTitles, () => {}), []);
  return <Ctx.Provider value={titles}>{children}</Ctx.Provider>;
}

export function useTitles() {
  return useContext(Ctx);
}

/** The title a user wears, if any. */
export function useWornTitle(userId: string): TitleDef | undefined {
  return titleById(useContext(Ctx).get(userId)?.worn);
}
