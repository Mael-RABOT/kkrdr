import { useRegisterSW } from 'virtual:pwa-register/react';
import { useT } from '../i18n';

export default function UpdatePrompt() {
  const t = useT();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="update card" role="status">
      <span>{t('common.newVersion')}</span>
      <div className="row">
        <button className="sm" onClick={() => setNeedRefresh(false)}>
          {t('common.later')}
        </button>
        <button className="sm primary" onClick={() => updateServiceWorker(true)}>
          {t('common.reload')}
        </button>
      </div>
    </div>
  );
}
