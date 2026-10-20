import { useSession } from './session';
import type { User } from './types';

/** Names compare without case, accents kept: "Lou" and " lou " are the same person. */
export function nameKey(name: string): string {
  return name.normalize('NFC').trim().toLocaleLowerCase();
}

export function nameTaken(users: Map<string, User>, name: string): boolean {
  const k = nameKey(name);
  return [...users.values()].some((u) => nameKey(u.name) === k);
}

/** Profile from the URL segment: a name, or an id (links made before names were used). */
export function findUser(users: Map<string, User>, param: string): User | undefined {
  const k = nameKey(param);
  return [...users.values()].find((u) => nameKey(u.name) === k) ?? users.get(param);
}

/** `(userId) => '/u/<name>'`, falling back to the id for unknown users. */
export function useProfilePath() {
  const { users } = useSession();
  return (userId: string) => `/u/${encodeURIComponent(users.get(userId)?.name ?? userId)}`;
}
