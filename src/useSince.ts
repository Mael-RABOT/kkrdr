import { useEffect, useState } from 'react';
import { subscribeSince } from './data';
import type { Poop } from './types';

/** Entries since `start` (e.g. the running week), live. null while loading. */
export function useSince(start: Date | null) {
  const from = start?.getTime();
  const [state, setState] = useState<{ from?: number; poops: Poop[] | null; error: string | null }>({ poops: null, error: null });
  useEffect(() => {
    if (from === undefined) return;
    return subscribeSince(
      new Date(from),
      (poops) => setState({ from, poops, error: null }),
      (e) => setState({ from, poops: null, error: e.message }),
    );
  }, [from]);
  // Nothing from an older start is shown while the new one loads.
  return state.from === from ? state : { poops: null, error: null };
}
