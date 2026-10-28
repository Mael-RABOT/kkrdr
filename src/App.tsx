import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useDialogs } from './dialogs';
import { useT } from './i18n';
import { AvatarsProvider } from './avatars';
import { FeedProvider } from './feed';
import { resetLocalData } from './firebase';
import { NotificationsProvider } from './notifications';
import { PoopsProvider } from './poops';
import { ReportsProvider } from './reportsProvider';
import { TitlesProvider } from './titlesProvider';
import { useSession } from './session';
import Spinner from './components/Spinner';
import TabBar from './components/TabBar';
import Welcome from './pages/Welcome';
import Feed from './pages/Feed';
import NewPoop from './pages/NewPoop';
import EditPoop from './pages/EditPoop';
import Stats from './pages/Stats';
import Top from './pages/Top';
import Profile from './pages/Profile';
import Shop from './pages/Shop';
import Admin from './pages/Admin';

export default function App() {
  const { status, slow, me } = useSession();
  const location = useLocation();
  const hasKeyParam = new URLSearchParams(location.search).has('key');

  if (status === 'loading' && !hasKeyParam) return <Boot slow={slow} />;

  if (status !== 'ready' || hasKeyParam) {
    return (
      <Routes>
        <Route path="*" element={<Welcome />} />
      </Routes>
    );
  }

  return (
    <FeedProvider>
      <PoopsProvider>
        <ReportsProvider>
          <TitlesProvider>
            <AvatarsProvider>
              <NotificationsProvider>
                <main className="page">
                  <Routes>
                    <Route path="/" element={<Feed />} />
                    <Route path="/new" element={<NewPoop />} />
                    <Route path="/edit/:id" element={<EditPoop />} />
                    <Route path="/top" element={<Top />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="/u/:name" element={<Profile />} />
                    <Route path="/shop" element={<Shop />} />
                    {me?.admin && <Route path="/admin" element={<Admin />} />}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
                <TabBar />
              </NotificationsProvider>
            </AvatarsProvider>
          </TitlesProvider>
        </ReportsProvider>
      </PoopsProvider>
    </FeedProvider>
  );
}

/** Startup screen. If it lasts, offer a way out instead of spinning forever. */
function Boot({ slow }: { slow: boolean }) {
  const t = useT();
  const dialogs = useDialogs();

  async function reset() {
    const ok = await dialogs.confirm({ title: t('boot.reset'), message: t('boot.resetConfirm'), confirmLabel: t('boot.reset'), danger: true });
    if (ok) await resetLocalData();
  }

  return (
    <main className="boot muted">
      <img src="/pwa-192x192.png" alt="" width={72} height={72} />
      <Spinner label={t('common.loading')} size="lg" />
      {slow && (
        <>
          <p>{t('boot.slow')}</p>
          <div className="row">
            <button onClick={() => location.reload()}>{t('boot.retry')}</button>
            <button className="danger" onClick={reset}>
              {t('boot.reset')}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
