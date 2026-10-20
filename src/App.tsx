import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useT } from './i18n';
import { PoopsProvider } from './poops';
import { useSession } from './session';
import TabBar from './components/TabBar';
import Welcome from './pages/Welcome';
import Feed from './pages/Feed';
import NewPoop from './pages/NewPoop';
import Stats from './pages/Stats';
import Top from './pages/Top';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

export default function App() {
  const t = useT();
  const { status, me } = useSession();
  const location = useLocation();
  const hasKeyParam = new URLSearchParams(location.search).has('key');

  if (status === 'loading' && !hasKeyParam) return <div className="center muted">{t('common.loading')}</div>;

  if (status !== 'ready' || hasKeyParam) {
    return (
      <Routes>
        <Route path="*" element={<Welcome />} />
      </Routes>
    );
  }

  return (
    <PoopsProvider>
      <main className="page">
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/new" element={<NewPoop />} />
          <Route path="/top" element={<Top />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/u/:id" element={<Profile />} />
          {me?.admin && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </PoopsProvider>
  );
}
