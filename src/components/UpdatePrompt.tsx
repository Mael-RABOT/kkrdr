import { useRegisterSW } from 'virtual:pwa-register/react';
import { terminate } from 'firebase/firestore';
import { db } from '../firebase';
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
        <button
          className="sm primary"
          // Close the local database first: the new version may need to upgrade it, and an open
          // connection from this page would block that and leave the new one stuck loading.
          onClick={() => terminate(db).finally(() => updateServiceWorker(true))}
        >
          {t('common.reload')}
        </button>
      </div>
    </div>
  );
}
