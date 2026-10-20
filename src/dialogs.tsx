import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import Modal from './components/Modal';
import { useT } from './i18n';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  /** Red confirm button, for destructive actions. */
  danger?: boolean;
  /** Gold confirm button. */
  gold?: boolean;
}

type Request =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'alert'; title?: string; message: string; resolve: () => void }
  | { kind: 'copy'; title: string; text: string; resolve: () => void };

type Pending = Request & { id: number };

let nextId = 0;

interface Dialogs {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
  /** Shows text to copy by hand, when the clipboard is not available. */
  copy: (title: string, text: string) => Promise<void>;
}

const Ctx = createContext<Dialogs | null>(null);

/** In-app replacements for alert / confirm / prompt. Calls queue up and show one at a time. */
export function DialogsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Pending[]>([]);
  const push = (r: Request) => setQueue((q) => [...q, { ...r, id: nextId++ }]);

  const api = useMemo<Dialogs>(
    () => ({
      confirm: (opts) => new Promise((resolve) => push({ kind: 'confirm', opts, resolve })),
      alert: (message, title) => new Promise((resolve) => push({ kind: 'alert', title, message, resolve })),
      copy: (title, text) => new Promise((resolve) => push({ kind: 'copy', title, text, resolve })),
    }),
    [],
  );

  const current = queue[0];
  function close(ok: boolean) {
    if (!current) return;
    if (current.kind === 'confirm') current.resolve(ok);
    else current.resolve();
    setQueue((q) => q.slice(1));
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* key: a fresh <dialog> for each popup */}
      {current && <DialogView key={current.id} pending={current} onClose={close} />}
    </Ctx.Provider>
  );
}

function DialogView({ pending, onClose }: { pending: Pending; onClose: (ok: boolean) => void }) {
  const t = useT();

  if (pending.kind === 'confirm') {
    const { title, message, confirmLabel, danger, gold } = pending.opts;
    return (
      <Modal onClose={() => onClose(false)}>
        {title && <h2>{title}</h2>}
        <p className="modal-text">{message}</p>
        <div className="modal-actions">
          <button type="button" onClick={() => onClose(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" className={danger ? 'danger-fill' : gold ? 'gold' : 'primary'} onClick={() => onClose(true)} autoFocus>
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </Modal>
    );
  }

  if (pending.kind === 'alert') {
    return (
      <Modal onClose={() => onClose(true)}>
        <h2>{pending.title ?? t('common.error')}</h2>
        <p className="modal-text">{pending.message}</p>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={() => onClose(true)} autoFocus>
            {t('common.ok')}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={() => onClose(true)}>
      <h2>{pending.title}</h2>
      <input readOnly value={pending.text} onFocus={(e) => e.target.select()} autoFocus />
      <div className="modal-actions">
        <button type="button" onClick={() => onClose(true)}>
          {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}

export function useDialogs() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDialogs outside provider');
  return c;
}
