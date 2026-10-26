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
  /** A photo for context (not of the poop): its version, the image itself is in pictures/{id}. */
  photo?: number;
  /** Or a GIF, by its Tenor / GIPHY URL. */
  gif?: string;
  /** A sound recording (a fart, a word…): its version and length; the audio is in sounds/{id}. */
  sound?: { v: number; secs: number };
  /** How many comments, kept in step with the comments subcollection. */
  commentCount?: number;
  /** Local changes not synced yet (client only, never stored). */
  pending?: boolean;
}

export interface PoopDoc extends Omit<Poop, 'id' | 'at' | 'createdAt' | 'pending'> {
  at: Timestamp;
  createdAt?: Timestamp | null;
}

/** A comment on an entry, in poops/{poopId}/comments. */
export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  editedAt?: Date;
  /** Users tagged with @ in the text (not the author), so they can be notified. */
  mentions?: string[];
  /** Local changes not synced yet (client only, never stored). */
  pending?: boolean;
}

/** A comment that tags you, and the entry it is on. */
export interface Mention {
  poopId: string;
  comment: Comment;
}

export const TYPE_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
export const SIZE_IDS: Size[] = ['S', 'M', 'L', 'XL'];
export const PLACE_IDS: Place[] = ['home', 'work', 'friends', 'public', 'other'];
export const COLOR_IDS: Color[] = ['brown', 'dark', 'light', 'yellow', 'green', 'red', 'black', 'grey'];
