import { describe, expect, it } from 'vitest';
import { fromGiphy, gifUrl, searchUrl } from './gifs';

describe('gifUrl', () => {
  it('turns Tenor page links into their GIF', () => {
    expect(gifUrl('https://tenor.com/view/happy-cat-gif-10804346947536782797')).toBe('https://tenor.com/view/happy-cat-gif-10804346947536782797.gif');
    expect(gifUrl('https://tenor.com/fr/view/happy-cat-gif-108/')).toBe('https://tenor.com/fr/view/happy-cat-gif-108.gif');
    expect(gifUrl('look https://tenor.com/bR3qP.gif lol')).toBe('https://tenor.com/bR3qP.gif');
  });
  it('keeps Tenor and GIPHY image links, without their query', () => {
    expect(gifUrl('https://media1.tenor.com/m/lfDATg4Bhc0AAAAC/happy-cat.gif')).toBe('https://media1.tenor.com/m/lfDATg4Bhc0AAAAC/happy-cat.gif');
    expect(gifUrl('https://media2.giphy.com/media/abc123/200.webp?cid=x&rid=y')).toBe('https://media2.giphy.com/media/abc123/200.webp');
    expect(gifUrl('https://i.giphy.com/abc123.gif')).toBe('https://i.giphy.com/abc123.gif');
  });
  it('turns GIPHY page links into their GIF', () => {
    expect(gifUrl('https://giphy.com/gifs/cat-dance-JIX9t2j0ZTN9S')).toBe('https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif');
    expect(gifUrl('https://giphy.com/gifs/JIX9t2j0ZTN9S')).toBe('https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif');
  });
  it('rejects anything else', () => {
    expect(gifUrl('')).toBeNull();
    expect(gifUrl('cat')).toBeNull();
    expect(gifUrl('https://evil.example.com/x.gif')).toBeNull();
    expect(gifUrl('https://tenor.com.evil.com/view/x-gif-1')).toBeNull();
    expect(gifUrl('https://tenor.com/search/cat-gifs')).toBeNull();
    expect(gifUrl('https://media.tenor.com/abc/cat.mp4')).toBeNull();
  });
});

describe('searchUrl', () => {
  it('opens the site search', () => {
    expect(searchUrl('tenor', ' happy  cat ')).toBe('https://tenor.com/search/happy-cat-gifs');
    expect(searchUrl('giphy', 'cat')).toBe('https://giphy.com/search/cat');
    expect(searchUrl('tenor', '')).toBe('https://tenor.com');
  });
});

describe('fromGiphy', () => {
  it('stores the 200 px tall WebP, without its query, and previews the small one', () => {
    const gifs = fromGiphy([
      {
        id: 'abc',
        title: 'Cat',
        images: {
          fixed_height: { url: 'https://media2.giphy.com/media/abc/200.gif?cid=1', webp: 'https://media2.giphy.com/media/abc/200.webp?cid=1' },
          fixed_width_small: { url: 'https://media2.giphy.com/media/abc/100w.gif', webp: 'https://media2.giphy.com/media/abc/100w.webp' },
        },
      },
      { id: 'bad', images: { fixed_height: { url: 'https://evil.example.com/x.gif' } } },
    ]);
    expect(gifs).toEqual([{ id: 'abc', title: 'Cat', preview: 'https://media2.giphy.com/media/abc/100w.webp', url: 'https://media2.giphy.com/media/abc/200.webp' }]);
  });
});
