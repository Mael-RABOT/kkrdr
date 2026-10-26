/** Sound recordings for entries: recorded in the browser, kept short and small. */

/** Longest recording, in seconds (see the sound rule in firestore.rules). */
export const MAX_SECS = 30;
/** Must stay under the limit in firestore.rules (sounds). */
export const MAX_SOUND_BYTES = 480_000;
/** Plenty for a voice or a fart; 30 s stay around 180 KB. */
const BITRATE = 48_000;

/**
 * Formats to record in, best first. AAC in MP4 plays on every phone, so it wins where it can be
 * recorded (Safari); elsewhere Opus, which recent iPhones play too.
 */
const TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];

export const canRecord = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;

export class TooBig extends Error {}

export interface Recording {
  /** Resolves with the audio once stopped (by stop() or after MAX_SECS). */
  done: Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string; secs: number }>;
  stop: () => void;
  /** Stops and throws the audio away. */
  cancel: () => void;
}

/** Asks for the microphone and starts recording. Throws if access is refused or unavailable. */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // Phones clean speech up; they would also take out the sounds people want to share.
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: BITRATE });
  const chunks: Blob[] = [];
  let cancelled = false;
  const started = Date.now();
  const release = () => stream.getTracks().forEach((t) => t.stop());

  const done = new Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string; secs: number }>((resolve, reject) => {
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onerror = () => {
      release();
      reject(new Error('recording failed'));
    };
    recorder.onstop = async () => {
      release();
      clearTimeout(limit);
      if (cancelled) return reject(new DOMException('cancelled', 'AbortError'));
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      if (blob.size > MAX_SOUND_BYTES) return reject(new TooBig());
      const secs = Math.min(MAX_SECS, Math.max(1, Math.round((Date.now() - started) / 1000)));
      resolve({ bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type, secs });
    };
  });
  // Without catching, a cancel would show up as an unhandled rejection.
  done.catch(() => {});

  const stop = () => recorder.state !== 'inactive' && recorder.stop();
  const limit = setTimeout(stop, MAX_SECS * 1000);
  recorder.start(1000);
  return {
    done,
    stop,
    cancel: () => {
      cancelled = true;
      stop();
    },
  };
}

/** "0:07" */
export function clock(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
