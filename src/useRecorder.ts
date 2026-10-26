import { useEffect, useRef, useState } from 'react';
import { MAX_SECS, MAX_SOUND_BYTES, startRecording, TooBig, type Recording } from './audio';
import type { Sound } from './data';
import { useT } from './i18n';

/**
 * A recording in a form: start() asks for the microphone, then `onDone` gets the audio once stopped
 * (by the user or at `maxSecs`). A recording still going when the form goes away is thrown away.
 */
export function useRecorder({ maxSecs = MAX_SECS, maxBytes = MAX_SOUND_BYTES, onDone }: { maxSecs?: number; maxBytes?: number; onDone: (s: Sound) => void }) {
  const t = useT();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // The latest recording, to stop it if the form goes away mid-recording.
  const live = useRef<Recording | null>(null);

  useEffect(() => () => live.current?.cancel(), []);

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
      rec = await startRecording(maxSecs, maxBytes);
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? t('sound.denied') : t('sound.unavailable'));
      return;
    } finally {
      setStarting(false);
    }
    live.current = rec;
    setRecording(rec);
    try {
      onDone(await rec.done);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof TooBig ? t('sound.tooBig') : t('sound.failed'));
    } finally {
      live.current = null;
      setRecording(null);
    }
  }

  return { recording, starting, elapsed, error, start };
}
