import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The event can fire before React mounts, so catch it at module load.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

function standalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone / iPad (iPadOS reports itself as a Mac with touch). iOS has no install prompt, only a manual way. */
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export function useInstall() {
  const [, rerender] = useState(0);

  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    const mq = matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', l);
    return () => {
      listeners.delete(l);
      mq.removeEventListener('change', l);
    };
  }, []);

  const installed = standalone();
  return {
    installed,
    canPrompt: !installed && deferred !== null,
    isIos: !installed && isIos,
    async prompt() {
      const e = deferred;
      if (!e) return;
      await e.prompt();
      await e.userChoice;
      deferred = null;
      notify();
    },
  };
}
