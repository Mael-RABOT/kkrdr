import { useT } from '../i18n';
import { useOnline } from '../useOnline';
import InstallButton from './InstallButton';
import LangSwitch from './LangSwitch';
import ThemeSwitch from './ThemeSwitch';

export default function PageHead({ title }: { title: string }) {
  const t = useT();
  const online = useOnline();
  return (
    <header className="page-head">
      <div className="page-head-top">
        <span className="wordmark">
          kkrdr
          {!online && <span className="pill offline">{t('common.offline')}</span>}
        </span>
        <span className="head-controls">
          <InstallButton />
          <ThemeSwitch />
          <LangSwitch />
        </span>
      </div>
      <h1>{title}</h1>
    </header>
  );
}
