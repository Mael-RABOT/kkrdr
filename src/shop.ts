/** Titles bought with poop points in the shop, one worn at a time. Prices are also in firestore.rules. */
export type TitleTier = 'bronze' | 'silver' | 'gold' | 'legend';

export interface TitleDef {
  id: string;
  price: number;
  tier: TitleTier;
}

/** Cheapest first. Names are in i18n under title.<id>. */
export const TITLES: TitleDef[] = [
  { id: 'rookie', price: 5, tier: 'bronze' },
  { id: 'buddy', price: 8, tier: 'bronze' },
  { id: 'regular', price: 15, tier: 'silver' },
  { id: 'flusher', price: 20, tier: 'silver' },
  { id: 'knight', price: 30, tier: 'gold' },
  { id: 'scholar', price: 35, tier: 'gold' },
  { id: 'master', price: 50, tier: 'legend' },
  { id: 'lord', price: 50, tier: 'legend' },
];

export const TITLE_TIERS: TitleTier[] = ['bronze', 'silver', 'gold', 'legend'];

export function titleById(id: string | undefined): TitleDef | undefined {
  return id ? TITLES.find((t) => t.id === id) : undefined;
}

/** What is stored in titles/{userId}. */
export interface Wardrobe {
  owned: Record<string, true>;
  /** Poop points spent so far. */
  spent: number;
  /** The title bought last (the rules check its price). */
  last?: string;
  worn?: string;
}

/**
 * Points left to spend. Earned points come from the reports; if one is deleted after a purchase,
 * the balance stays at 0 rather than going negative.
 */
export function balance(earned: number, spent: number): number {
  return Math.max(0, earned - spent);
}
