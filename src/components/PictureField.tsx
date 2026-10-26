import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Photo } from '../data';
import { useT } from '../i18n';
import { encodePhoto } from '../image';
import type { Poop } from '../types';
import GifPicker from './GifPicker';
import PostMedia from './PostMedia';
import Spinner from './Spinner';

/** What the entry shows: nothing, the photo it already has, a new photo, or a GIF. */
export type Attachment =
  | { kind: 'none' }
  | { kind: 'current' }
  | { kind: 'photo'; photo: Photo; preview: string }
  | { kind: 'gif'; url: string };

export function initialAttachment(p?: Poop): Attachment {
  if (p?.gif) return { kind: 'gif', url: p.gif };
  if (p?.photo) return { kind: 'current' };
  return { kind: 'none' };
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Icon({ kind }: { kind: 'camera' | 'gallery' | 'gif' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      {kind === 'camera' && (
        <>
          <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" {...stroke} />
          <circle cx="12" cy="13" r="3.5" {...stroke} />
        </>
      )}
      {kind === 'gallery' && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" {...stroke} />
          <circle cx="9" cy="9.5" r="1.8" {...stroke} />
          <path d="M3 17l5-5 4 4 3-3 6 6" {...stroke} />
        </>
      )}
      {kind === 'gif' && (
        <>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" {...stroke} />
          <path d="M10 10.2a2.2 2.2 0 1 0 0 3.6V12H8.8M13 9.5v5M16 14.5v-5h2.5M16 12h2" {...stroke} />
        </>
      )}
    </svg>
  );
}

/**
 * Optional picture for context (what you ate, your face…), never the poop itself: from the camera,
 * the gallery, or a GIF from Tenor / GIPHY.
 */
export default function PictureField({ entry, value, onChange }: { entry?: Poop; value: Attachment; onChange: (a: Attachment) => void }) {
  const t = useT();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const preview = value.kind === 'photo' ? value.preview : null;

  // Free the preview once replaced or gone.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Same file twice in a row must still fire a change.
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await encodePhoto(file);
      onChange({ kind: 'photo', photo, preview: URL.createObjectURL(new Blob([photo.bytes], { type: photo.type })) });
    } catch {
      setError(t('log.pictureUnreadable'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="picture-field">
      <p className="picture-hint">{t('log.pictureHint')}</p>
      {value.kind !== 'none' ? (
        <div className="picture-preview">
          {value.kind === 'current' && entry && <PostMedia poop={entry} eager />}
          {value.kind === 'photo' && <img className="post-media photo" src={value.preview} alt={t('log.picture')} />}
          {value.kind === 'gif' && <img className="post-media gif" src={value.url} alt={t('log.gif')} />}
          <button type="button" className="picture-remove" onClick={() => onChange({ kind: 'none' })} aria-label={t('log.pictureRemove')} title={t('log.pictureRemove')}>
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : busy ? (
        <div className="picture-busy">
          <Spinner label={t('log.pictureProcessing')} show />
        </div>
      ) : (
        <div className="picture-actions">
          <button type="button" onClick={() => camera.current?.click()}>
            <Icon kind="camera" />
            {t('log.camera')}
          </button>
          <button type="button" onClick={() => gallery.current?.click()}>
            <Icon kind="gallery" />
            {t('log.gallery')}
          </button>
          <button type="button" onClick={() => setPicking(true)}>
            <Icon kind="gif" />
            {t('log.gif')}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={onFile} />
      {picking && (
        <GifPicker
          onClose={() => setPicking(false)}
          onPick={(url) => {
            setPicking(false);
            onChange({ kind: 'gif', url });
          }}
        />
      )}
    </div>
  );
}
