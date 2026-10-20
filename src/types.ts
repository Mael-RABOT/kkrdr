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
}

export interface PoopDoc extends Omit<Poop, 'id' | 'at'> {
  at: Timestamp;
}

export const TYPES: Record<number, string> = {
  1: 'Hard lumps',
  2: 'Lumpy',
  3: 'Cracked',
  4: 'Smooth',
  5: 'Soft blobs',
  6: 'Mushy',
  7: 'Liquid',
};

export const SIZES: Record<Size, string> = {
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  XL: 'Huge',
};

export const PLACES: Record<Place, string> = {
  home: 'Home',
  work: 'Work',
  friends: "Friend's",
  public: 'Public',
  other: 'Other',
};
