import { useState } from 'react';
import { useT } from '../i18n';
import { useInstall } from '../useInstall';
import Modal from './Modal';

/** "Install" pill: the browser prompt where there is one, a short guide on iOS, nothing once installed. */
export default function InstallButton() {
  const t = useT();
  const { canPrompt, isIos, prompt } = useInstall();
  const [guide, setGuide] = useState(false);

  if (!canPrompt && !isIos) return null;

  return (
    <>
      <button type="button" className="install-btn" onClick={() => (canPrompt ? void prompt() : setGuide(true))}>
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t('install.button')}
      </button>
      {guide && (
        <Modal className="install-guide" onClose={() => setGuide(false)}>
          <h2>{t('install.title')}</h2>
          <p className="muted">{t('install.intro')}</p>
          <ol>
            <li>{t('install.step1')}</li>
            <li>{t('install.step2')}</li>
            <li>{t('install.step3')}</li>
          </ol>
          <p className="hint">{t('install.safari')}</p>
          <div className="modal-actions">
            <button type="button" className="primary" onClick={() => setGuide(false)}>
              {t('common.close')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
