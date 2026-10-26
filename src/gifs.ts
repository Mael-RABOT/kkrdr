/**
 * GIFs: searched in the app through GIPHY when a key is set, or found on the Tenor / GIPHY
 * websites and pasted as a link (Tenor's API was shut down in 2026, so Tenor only works that way).
 */

/** Tenor's / GIPHY's search page for a query, to open in a new tab. */
export function searchUrl(site: 'tenor' | 'giphy', q: string): string {
  const words = q.trim().toLowerCase().replace(/\s+/g, '-');
  if (site === 'tenor') return words ? `https://tenor.com/search/${encodeURIComponent(words)}-gifs` : 'https://tenor.com';
  return words ? `https://giphy.com/search/${encodeURIComponent(words)}` : 'https://giphy.com';
}

/** Stays in step with the gif rule in firestore.rules. */
const STORED = /^https:\/\/((media[0-9]*|c)\.tenor\.com|(media[0-9]*|i)\.giphy\.com)\/\S+$|^https:\/\/tenor\.com\/\S+\.gif$/;

/**
 * The image URL to store for a pasted link, or null if it isn't a GIF from Tenor or GIPHY.
 * Page links are turned into image links: a Tenor page + ".gif" redirects to the GIF itself, and a
 * GIPHY page's id gives its media URL.
 */
export function gifUrl(input: string): string | null {
  // The link may come with text around it ("Check this out https://…").
  const match = input.match(/https?:\/\/\S+/);
  if (!match) return null;
  let url: URL;
  try {
    url = new URL(match[0].replace(/^http:/, 'https:'));
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  let out: string | null = null;

  if (host === 'tenor.com') {
    // /view/<slug>-gif-<id>, maybe after a language (/fr/view/…), or a short /<code>.gif link.
    if (/\.gif$/.test(path)) out = `https://tenor.com${path}`;
    else if (/^(\/[a-z]{2}(-[A-Za-z]{2})?)?\/view\/[\w-]+$/.test(path)) out = `https://tenor.com${path}.gif`;
  } else if (/^(media[0-9]*|c)\.tenor\.com$/.test(host)) {
    if (!/\.mp4$/.test(path)) out = `https://${host}${path}`;
  } else if (host === 'giphy.com') {
    // /gifs/<slug>-<id> or /gifs/<id>; the id is the last part.
    const m = path.match(/^\/(gifs|stickers)\/(?:[\w-]*-)?([A-Za-z0-9]+)$/);
    if (m) out = `https://media.giphy.com/media/${m[2]}/giphy.gif`;
  } else if (/^(media[0-9]*|i)\.giphy\.com$/.test(host)) {
    if (!/\.mp4$/.test(path)) out = `https://${host}${path}`;
  }
  return out && out.length <= 500 && STORED.test(out) ? out : null;
}

// ---- search, inside the app (GIPHY) ----

/** GIPHY API key (developers.giphy.com). Without one, only pasting a link is offered. */
const KEY: string | undefined = import.meta.env.VITE_GIPHY_API_KEY || undefined;

export const gifSearchEnabled = !!KEY;

export interface Gif {
  id: string;
  title: string;
  /** Small rendition for the picker grid. */
  preview: string;
  /** What is stored on the entry (200 px tall). */
  url: string;
}

interface Rendition {
  url?: string;
  webp?: string;
}

interface GiphyItem {
  id: string;
  title?: string;
  images: { fixed_width_small?: Rendition; fixed_width?: Rendition; fixed_height?: Rendition };
}

/** GIPHY results as picker items; ones whose URL the rules would refuse are left out. */
export function fromGiphy(data: GiphyItem[]): Gif[] {
  return data.flatMap((g) => {
    const big = g.images.fixed_height ?? g.images.fixed_width;
    const small = g.images.fixed_width_small ?? g.images.fixed_width ?? big;
    const url = gifUrl(big?.webp ?? big?.url ?? '');
    const preview = small?.webp ?? small?.url;
    return url && preview ? [{ id: g.id, title: g.title ?? '', preview, url }] : [];
  });
}

/** Results already fetched in this session: the free key allows 100 calls an hour for everyone. */
const cache = new Map<string, Gif[]>();

export class RateLimited extends Error {}

/** Trending GIFs for an empty query, else search results. */
export async function searchGifs(q: string, lang: string, signal?: AbortSignal): Promise<Gif[]> {
  if (!KEY) return [];
  const query = q.trim().toLowerCase();
  const key = `${lang}:${query}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const params = new URLSearchParams({ api_key: KEY, limit: '30', rating: 'pg-13', bundle: 'messaging_non_clips' });
  if (query) {
    params.set('q', query);
    params.set('lang', lang);
  }
  const res = await fetch(`https://api.giphy.com/v1/gifs/${query ? 'search' : 'trending'}?${params}`, { signal });
  if (res.status === 429) throw new RateLimited();
  if (!res.ok) throw new Error(`GIPHY ${res.status}`);
  const gifs = fromGiphy(((await res.json()) as { data: GiphyItem[] }).data);
  cache.set(key, gifs);
  return gifs;
}
