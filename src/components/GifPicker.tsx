import { useEffect, useState } from 'react';
import { gifSearchEnabled, gifUrl, RateLimited, searchGifs, searchUrl, type Gif } from '../gifs';
import { useI18n, useT } from '../i18n';
import Modal from './Modal';
import Spinner from './Spinner';

const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;

/**
 * Pick a GIF: searched right here (GIPHY), or pasted as a link from Tenor / GIPHY.
 * Without a GIPHY key, only the link.
 */
export default function GifPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const t = useT();
  const [byLink, setByLink] = useState(!gifSearchEnabled);

  return (
    <Modal onClose={onClose} className="gif-modal">
      <h2>{t('gif.title')}</h2>
      {gifSearchEnabled && <Search onPick={onPick} />}
      {gifSearchEnabled && !byLink && (
        <button type="button" className="link gif-other" onClick={() => setByLink(true)}>
          {t('gif.byLink')}
        </button>
      )}
      {byLink && <ByLink onPick={onPick} withSearch={gifSearchEnabled} />}
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </Modal>
  );
}

/** Search box and results; trending until something is typed. A tap picks. */
function Search({ onPick }: { onPick: (url: string) => void }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    // Wait for a pause in typing: every call counts against the key's hourly limit.
    const id = setTimeout(
      () => {
        setGifs(null);
        setError(null);
        searchGifs(q, lang, ctrl.signal).then(setGifs, (e: Error) => {
          if (e.name === 'AbortError') return;
          setError(e instanceof RateLimited ? t('gif.rateLimited') : t('gif.error', { msg: e.message }));
        });
      },
      q.trim() ? 500 : 0,
    );
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, lang, t]);

  return (
    <section className="gif-search">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('gif.searchPlaceholder')} enterKeyHint="search" />
      {error && <p className="error">{error}</p>}
      {!gifs && !error && (
        <div className="gif-loading">
          <Spinner label={t('common.loading')} />
        </div>
      )}
      {gifs?.length === 0 && <p className="muted">{t('gif.none')}</p>}
      {!!gifs?.length && (
        <ul className="gif-grid">
          {gifs.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => onPick(g.url)} title={g.title} aria-label={g.title || t('log.gif')}>
                <img src={g.preview} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="gif-credit">{t('gif.powered')}</p>
    </section>
  );
}

/** Find a GIF on Tenor or GIPHY (opens their site), then paste its link. */
function ByLink({ onPick, withSearch }: { onPick: (url: string) => void; withSearch: boolean }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [link, setLink] = useState('');
  const [loaded, setLoaded] = useState<string | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const url = gifUrl(link);

  async function paste() {
    try {
      setLink(await navigator.clipboard.readText());
    } catch {
      // Refused: typing or long-press paste still works.
    }
  }

  return (
    <div className="gif-by-link">
      {withSearch && <h3 className="gif-by-link-title">{t('gif.byLink')}</h3>}
      <section className="gif-step">
        <h3>{t('gif.step1')}</h3>
        {!withSearch && (
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('gif.searchPlaceholder')} enterKeyHint="search" />
        )}
        <div className="gif-sites">
          <a className="gif-site" href={searchUrl('tenor', q)} target="_blank" rel="noreferrer">
            {t('gif.onTenor')}
          </a>
          <a className="gif-site" href={searchUrl('giphy', q)} target="_blank" rel="noreferrer">
            {t('gif.onGiphy')}
          </a>
        </div>
      </section>

      <section className="gif-step">
        <h3>{t('gif.step2')}</h3>
        <div className="gif-paste">
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder={t('gif.linkPlaceholder')} inputMode="url" />
          {canPaste && (
            <button type="button" onClick={paste}>
              {t('gif.paste')}
            </button>
          )}
        </div>
        {link.trim() && !url && <p className="error">{t('gif.invalid')}</p>}
        {url && broken === url && <p className="error">{t('gif.broken')}</p>}
        {url && broken !== url && (
          <img
            key={url}
            className={`gif-preview${loaded === url ? '' : ' loading'}`}
            src={url}
            alt=""
            onLoad={() => setLoaded(url)}
            onError={() => setBroken(url)}
          />
        )}
        <button type="button" className="primary" disabled={!url || loaded !== url} onClick={() => url && onPick(url)}>
          {t('gif.add')}
        </button>
      </section>
    </div>
  );
}
