import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSession } from './session';
import TabBar from './components/TabBar';
import Welcome from './pages/Welcome';
import Feed from './pages/Feed';
import NewPoop from './pages/NewPoop';
import Stats from './pages/Stats';
import Admin from './pages/Admin';

export default function App() {
  const { status, me } = useSession();
  const location = useLocation();
  const hasKeyParam = new URLSearchParams(location.search).has('key');

  if (status === 'loading' && !hasKeyParam) return <div className="center muted">Loading</div>;

  if (status !== 'ready' || hasKeyParam) {
    return (
      <Routes>
        <Route path="*" element={<Welcome />} />
      </Routes>
    );
  }

  return (
    <>
      <main className="page">
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/new" element={<NewPoop />} />
          <Route path="/stats" element={<Stats />} />
          {me?.admin && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  );
}
