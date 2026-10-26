import { useEffect, useRef, useState } from 'react';
import { clock } from '../audio';
import { getSound } from '../data';
import { useT } from '../i18n';
import type { Poop } from '../types';

/** The one playing, so starting another pauses it. */
let current: HTMLAudioElement | null = null;

/**
 * Play / pause and progress for a recording. The audio is only fetched on the first play.
 * `secs` drives the progress: recordings from some browsers don't know their own length.
 */
export function SoundPlayer({ secs, load }: { secs: number; load: () => Promise<string | null> }) {
  const t = useT();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [at, setAt] = useState(0);

  // Stop when the player goes away (popup closed, entry scrolled off and unmounted…).
  useEffect(
    () => () => {
      audio.current?.pause();
      if (current === audio.current) current = null;
    },
    [],
  );

  async function toggle() {
    let a = audio.current;
    if (a && !a.paused) return a.pause();
    if (!a) {
      setState('loading');
      const url = await load().catch(() => null);
      if (!url) return setState('error');
      a = new Audio(url);
      a.ontimeupdate = () => setAt(a!.currentTime);
      a.onplay = () => setState('playing');
      a.onpause = () => setState('paused');
      a.onended = () => {
        setAt(0);
        setState('idle');
      };
      a.onerror = () => setState('error');
      audio.current = a;
    }
    if (current && current !== a) current.pause();
    current = a;
    a.play().catch(() => setState('error'));
  }

  const playing = state === 'playing';
  const progress = Math.min(1, at / secs);
  return (
    <div className={`sound-player${playing ? ' playing' : ''}`}>
      <button type="button" className="sound-toggle" onClick={toggle} disabled={state === 'loading'} aria-label={playing ? t('sound.pause') : t('sound.play')}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /> : <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />}
        </svg>
      </button>
      <span className="sound-track" aria-hidden>
        <span className="sound-bar" style={{ width: `${progress * 100}%` }} />
      </span>
      <span className="sound-time">{state === 'error' ? t('sound.error') : clock(playing || state === 'paused' ? at : secs)}</span>
    </div>
  );
}

/** An entry's recording, if it has one. */
export default function PostSound({ poop: p }: { poop: Poop }) {
  if (!p.sound) return null;
  const { v, secs } = p.sound;
  return <SoundPlayer key={v} secs={secs} load={() => getSound(p.id, v)} />;
}
