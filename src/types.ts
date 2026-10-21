import type { Timestamp } from 'firebase/firestore';

export type Size = 'S' | 'M' | 'L' | 'XL';
export type Place = 'home' | 'work' | 'friends' | 'public' | 'other';
export type Color = 'brown' | 'dark' | 'light' | 'yellow' | 'green' | 'red' | 'black' | 'grey';

export interface User {
  id: string;
  name: string;
  admin: boolean;
  active: boolean;
}

export interface Poop {
  id: string;
  userId: string;
  at: Date;
  type: number;
  size: Size;
  place: Place;
  placeNote?: string;
  duration?: number;
  rating?: number;
  /** Just for the record, no effect on the score. */
  color?: Color;
  note?: string;
  votes?: Record<string, 1 | -1>;
  /** One piece, leaves no mark. Always type 4 rated 5. */
  perfect?: boolean;
  /** When it was posted (server time). */
  createdAt?: Date;
}

export interface PoopDoc extends Omit<Poop, 'id' | 'at' | 'createdAt'> {
  at: Timestamp;
  createdAt?: Timestamp | null;
}

export const TYPE_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
export const SIZE_IDS: Size[] = ['S', 'M', 'L', 'XL'];
export const PLACE_IDS: Place[] = ['home', 'work', 'friends', 'public', 'other'];
export const COLOR_IDS: Color[] = ['brown', 'dark', 'light', 'yellow', 'green', 'red', 'black', 'grey'];
