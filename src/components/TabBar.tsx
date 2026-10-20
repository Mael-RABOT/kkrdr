import { NavLink } from 'react-router-dom';
import { useT } from '../i18n';
import { useSession } from '../session';

export default function TabBar() {
  const t = useT();
  const { me } = useSession();
  return (
    <nav className="tabbar">
      <NavLink to="/" end>
        {t('tab.feed')}
      </NavLink>
      <NavLink to="/top">{t('tab.top')}</NavLink>
      <NavLink to="/new" className="tab-log" aria-label={t('log.title')}>
        +
      </NavLink>
      <NavLink to="/stats">{t('tab.stats')}</NavLink>
      {me?.admin && <NavLink to="/admin">{t('tab.admin')}</NavLink>}
    </nav>
  );
}
