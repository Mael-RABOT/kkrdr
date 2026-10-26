import { useEffect, useRef, useState } from 'react';
import { canRecord, clock, MAX_SECS, startRecording, TooBig, type Recording } from '../audio';
import { getSound, type Sound } from '../data';
import { useT } from '../i18n';
import type { Poop } from '../types';
import { SoundPlayer } from './SoundPlayer';

/** The entry's sound: none, the one it already has, or a new recording. */
export type SoundValue = { kind: 'none' } | { kind: 'current' } | { kind: 'new'; sound: Sound; preview: string };

export const initialSound = (p?: Poop): SoundValue => (p?.sound ? { kind: 'current' } : { kind: 'none' });

/** Optional recording for an entry: a fart, a word, anything, up to MAX_SECS. */
export default function SoundField({
  entry,
  value,
  onChange,
  onRecording,
}: {
  entry?: Poop;
  value: SoundValue;
  onChange: (v: SoundValue) => void;
  /** Whether a recording is going on (the form waits for it before saving). */
  onRecording?: (on: boolean) => void;
}) {
  const t = useT();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const preview = value.kind === 'new' ? value.preview : null;
  // The latest recording, to stop it if the form goes away mid-recording.
  const live = useRef<Recording | null>(null);

  useEffect(() => () => live.current?.cancel(), []);
  useEffect(() => onRecording?.(!!recording), [recording, onRecording]);
  // Free the preview once replaced or gone.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // Elapsed time while recording.
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 200);
    return () => clearInterval(id);
  }, [recording]);

  async function start() {
    setError(null);
    setStarting(true);
    let rec: Recording;
    try {
      rec = await startRecording();
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? t('sound.denied') : t('sound.unavailable'));
      return;
    } finally {
      setStarting(false);
    }
    live.current = rec;
    setRecording(rec);
    try {
      const sound = await rec.done;
      onChange({ kind: 'new', sound, preview: URL.createObjectURL(new Blob([sound.bytes], { type: sound.type })) });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof TooBig ? t('sound.tooBig') : t('sound.failed'));
    } finally {
      live.current = null;
      setRecording(null);
    }
  }

  if (!canRecord) return <p className="muted">{t('sound.unsupported')}</p>;

  return (
    <div className="sound-field">
      <p className="picture-hint">{t('sound.hint', { n: MAX_SECS })}</p>
      {recording ? (
        <div className="sound-recording">
          <span className="rec-dot" aria-hidden />
          <span className="rec-time">
            {clock(elapsed)} / {clock(MAX_SECS)}
          </span>
          <button type="button" className="link" onClick={recording.cancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="primary sm" onClick={recording.stop}>
            {t('sound.stop')}
          </button>
        </div>
      ) : value.kind === 'none' ? (
        <button type="button" className="sound-record" onClick={start} disabled={starting}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {t('sound.record')}
        </button>
      ) : (
        <div className="sound-chosen">
          {value.kind === 'new' && <SoundPlayer key={value.preview} secs={value.sound.secs} load={async () => value.preview} />}
          {value.kind === 'current' && entry?.sound && (
            <SoundPlayer key={entry.sound.v} secs={entry.sound.secs} load={() => getSound(entry.id, entry.sound!.v)} />
          )}
          <button type="button" className="link danger" onClick={() => onChange({ kind: 'none' })}>
            {t('sound.remove')}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
