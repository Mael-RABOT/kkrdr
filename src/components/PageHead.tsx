import { useT } from '../i18n';
import { useOnline } from '../useOnline';
import LangSwitch from './LangSwitch';

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
        <LangSwitch />
      </div>
      <h1>{title}</h1>
    </header>
  );
}
