import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppVersion from '../components/AppVersion';
import InstallButton from '../components/InstallButton';
import LangSwitch from '../components/LangSwitch';
import Spinner from '../components/Spinner';
import ThemeSwitch from '../components/ThemeSwitch';
import { useT, type Key } from '../i18n';
import { useSession } from '../session';
import { useOnline } from '../useOnline';

export default function Welcome() {
  const t = useT();
  const { authReady, error, link } = useSession();
  const online = useOnline();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [key, setKey] = useState(params.get('key') ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const autoTried = useRef(false);

  async function submit(k: string) {
    setBusy(true);
    setMsg(null);
    try {
      await link(k);
      navigate('/', { replace: true });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  // Invite links carry ?key=..., link automatically once auth is ready and the device is online.
  useEffect(() => {
    const k = params.get('key');
    if (k && authReady && online && !autoTried.current) {
      autoTried.current = true;
      void submit(k);
    }
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(key);
  }

  return (
    <main className="welcome">
      <div className="card welcome-card">
        <img className="brand-logo" src="/pwa-192x192.png" alt="" width={96} height={96} />
        <h1 className="brand">
          kk<span>rdr</span>
        </h1>
        <p className="tagline">{t('welcome.tagline')}</p>
        <form onSubmit={onSubmit} className="stack">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('welcome.key')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
          />
          <button className="primary big" disabled={busy || !authReady || !online || !key.trim()}>
            {busy ? <Spinner label={t('welcome.checking')} size="sm" show /> : t('welcome.continue')}
          </button>
        </form>
        {!online && <p className="hint">{t('welcome.offline')}</p>}
        {(msg ?? error) && <p className="error">{t((msg ?? error) as Key)}</p>}
        <div className="welcome-lang head-controls">
          <InstallButton />
          <ThemeSwitch />
          <LangSwitch />
          <AppVersion />
        </div>
      </div>
    </main>
  );
}
