import { NavLink } from 'react-router-dom';
import { useSession } from '../session';

export default function TabBar() {
  const { me } = useSession();
  return (
    <nav className="tabbar">
      <NavLink to="/" end>
        Feed
      </NavLink>
      <NavLink to="/new" className="tab-log">
        + Log
      </NavLink>
      <NavLink to="/stats">Stats</NavLink>
      {me?.admin && <NavLink to="/admin">Admin</NavLink>}
    </nav>
  );
}
