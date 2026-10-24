import { useState } from 'react';
import { CHANGELOG } from '../changelog';
import { useI18n } from '../i18n';
import Modal from './Modal';

/** The app version, from package.json (injected at build time by vite.config.ts). A tap shows what changed. */
export default function AppVersion() {
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [older, setOlder] = useState(false);
  const i = CHANGELOG.findIndex((c) => c.version === __APP_VERSION__);
  const current = CHANGELOG[i];
  const before = i >= 0 ? CHANGELOG.slice(i + 1) : CHANGELOG;
  const list = (items: (typeof CHANGELOG)[number]['items']) => (
    <ul className="changelog">
      {items.map((it) => (
        <li key={it.en}>{it[lang]}</li>
      ))}
    </ul>
  );

  return (
    <>
      <button type="button" className="app-version" onClick={() => setOpen(true)}>
        v{__APP_VERSION__}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} className="changelog-modal">
          <h2>{t('changelog.title', { version: __APP_VERSION__ })}</h2>
          {current && list(current.items)}
          {before.length > 0 &&
            (older ? (
              <>
                <h3>{t('changelog.older')}</h3>
                {before.map((c) => (
                  <div key={c.version}>
                    <h4>v{c.version}</h4>
                    {list(c.items)}
                  </div>
                ))}
              </>
            ) : (
              <button type="button" className="sm more" onClick={() => setOlder(true)}>
                {t('changelog.older')}
              </button>
            ))}
          <div className="modal-actions">
            <button type="button" className="primary" onClick={() => setOpen(false)}>
              {t('common.close')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
