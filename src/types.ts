import type { Timestamp } from 'firebase/firestore';

export type Size = 'S' | 'M' | 'L' | 'XL';
export type Place = 'home' | 'work' | 'friends' | 'public' | 'other';

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
  note?: string;
  votes?: Record<string, 1 | -1>;
}

export interface PoopDoc extends Omit<Poop, 'id' | 'at'> {
  at: Timestamp;
}

export const TYPE_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
export const SIZE_IDS: Size[] = ['S', 'M', 'L', 'XL'];
export const PLACE_IDS: Place[] = ['home', 'work', 'friends', 'public', 'other'];
