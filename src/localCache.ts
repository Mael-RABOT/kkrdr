/** Small JSON copies in localStorage, shown before Firestore's own cache has opened. Always optional. */
export function readLocal<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

/** Skips values over `maxChars` (localStorage is ~5 MB and shared with the rest of the app). */
export function writeLocal(key: string, value: unknown, maxChars = 1_000_000) {
  try {
    const json = JSON.stringify(value);
    if (json.length <= maxChars) localStorage.setItem(key, json);
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable or full
  }
}
