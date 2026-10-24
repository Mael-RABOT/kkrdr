import type { User } from './types';

/** Names can't be longer (see the users rules), so neither can what follows an @ being typed. */
const MAX_NAME = 30;

/** The @mention being typed just before the caret: where its @ is and what follows it. */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const at = text.lastIndexOf('@', caret - 1);
  if (at < 0) return null;
  // The @ starts a word.
  if (at > 0 && !/\s/.test(text[at - 1])) return null;
  const query = text.slice(at + 1, caret);
  if (query.length > MAX_NAME || query.includes('\n')) return null;
  return { start: at, query };
}

/** Active users whose name starts with the query, by name. */
export function suggest(users: Iterable<User>, query: string, max = 5): User[] {
  const q = query.toLocaleLowerCase();
  return [...users]
    .filter((u) => u.active && u.name.toLocaleLowerCase().startsWith(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, max);
}

export type Part = string | { user: User };

/**
 * Splits a comment into text and @mentions of known users. Names may contain spaces, so the
 * longest name that fits wins; a name must not run on into a letter or digit.
 */
export function splitMentions(text: string, users: Iterable<User>): Part[] {
  const byLength = [...users].filter((u) => u.name).sort((a, b) => b.name.length - a.name.length);
  const parts: Part[] = [];
  let plain = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '@' && (i === 0 || /\s/.test(text[i - 1]))) {
      const rest = text.slice(i + 1).toLocaleLowerCase();
      const user = byLength.find((u) => {
        const n = u.name.toLocaleLowerCase();
        return rest.startsWith(n) && !/[\p{L}\p{N}]/u.test(rest.charAt(n.length));
      });
      if (user) {
        if (plain) parts.push(plain);
        plain = '';
        parts.push({ user });
        i += 1 + user.name.length;
        continue;
      }
    }
    plain += text[i++];
  }
  if (plain) parts.push(plain);
  return parts;
}
