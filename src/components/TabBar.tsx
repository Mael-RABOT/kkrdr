import { NavLink } from 'react-router-dom';
import { useT } from '../i18n';
import { useSession } from '../session';
import { useProfilePath } from '../users';

export default function TabBar() {
  const t = useT();
  const { me } = useSession();
  const profilePath = useProfilePath();
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
      {me && <NavLink to={profilePath(me.id)}>{t('tab.profile')}</NavLink>}
      {me?.admin && <NavLink to="/admin">{t('tab.admin')}</NavLink>}
    </nav>
  );
}
