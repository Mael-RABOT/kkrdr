import { useT } from '../i18n';
import { usePendingCount } from '../poops';
import { useOnline } from '../useOnline';
import AppVersion from './AppVersion';
import InstallButton from './InstallButton';
import LangSwitch from './LangSwitch';
import ThemeSwitch from './ThemeSwitch';

export default function PageHead({ title }: { title: string }) {
  const t = useT();
  const online = useOnline();
  const pending = usePendingCount();
  return (
    <header className="page-head">
      <div className="page-head-top">
        <span className="wordmark">
          <img src="/pwa-64x64.png" alt="" width={20} height={20} />
          kkrdr
          {!online && <span className="pill offline">{t('common.offline')}</span>}
          {pending > 0 && <span className="pill pending sync">{t('common.pendingCount', { n: pending })}</span>}
        </span>
        <span className="head-controls">
          <InstallButton />
          <ThemeSwitch />
          <LangSwitch />
          <AppVersion />
        </span>
      </div>
      <h1>{title}</h1>
    </header>
  );
}
