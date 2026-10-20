import { useEffect, useState, type FormEvent } from 'react';
import Avatar from '../components/Avatar';
import PageHead from '../components/PageHead';
import { countPoops, createUser, inviteLink, keysFor, regenerateKey, removeUser, revokeKeys, updateUser } from '../data';
import { useT } from '../i18n';
import { useSession } from '../session';
import type { User } from '../types';

export default function Admin() {
  const t = useT();
  const { users } = useSession();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ userId: string; key: string | null } | null>(null);
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);

  const list = [...users.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    await run(async () => {
      setCreated({ name: n, key: await createUser(n) });
      setName('');
    });
  }

  return (
    <>
      <PageHead title={t('admin.title')} />

      <section className="card">
        <h2>{t('admin.add')}</h2>
        <form onSubmit={onAdd} className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('admin.name')} maxLength={30} />
          <button className="primary" disabled={busy || !name.trim()}>
            {t('admin.addBtn')}
          </button>
        </form>
        {created && (
          <>
            <p className="hint">{t('admin.sendLink', { name: created.name })}</p>
            <KeyBox k={created.key} />
          </>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>{t('admin.people')}</h2>
        <ul className="users">
          {list.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              busy={busy}
              run={run}
              shownKey={shown?.userId === u.id ? shown.key : undefined}
              setShown={(key) => setShown({ userId: u.id, key })}
            />
          ))}
        </ul>
      </section>
    </>
  );
}

function UserRow({
  user,
  busy,
  run,
  shownKey,
  setShown,
}: {
  user: User;
  busy: boolean;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  shownKey: string | null | undefined;
  setShown: (key: string | null) => void;
}) {
  const t = useT();
  const { me } = useSession();
  const [count, setCount] = useState<number | null>(null);
  const self = user.id === me?.id;

  useEffect(() => {
    countPoops(user.id).then(setCount, () => setCount(null));
  }, [user.id]);

  return (
    <li className={user.active ? '' : 'inactive'}>
      <div className="user-head">
        <Avatar id={user.id} name={user.name} />
        <span className="lb-main">
          <span className="lb-name">
            {user.name}
            {self && <span className="muted"> ({t('common.you')})</span>}
          </span>
          <span className="tags">
            <span className="lb-sub">{t('admin.logged', { n: count ?? '–' })}</span>
            {user.admin && <span className="pill amber">{t('admin.isAdmin')}</span>}
            {!user.active && <span className="pill danger">{t('admin.inactive')}</span>}
          </span>
        </span>
      </div>
      <div className="actions">
        <button
          className="sm"
          disabled={busy}
          onClick={() => run(async () => setShown((await keysFor(user.id))[0] ?? null))}
        >
          {t('admin.key')}
        </button>
        <button
          className="sm"
          disabled={busy}
          onClick={() =>
            confirm(t('admin.confirmNewKey', { name: user.name })) &&
            run(async () => setShown(await regenerateKey(user.id)))
          }
        >
          {t('admin.newKey')}
        </button>
        {!self && (
          <>
            <button
              className="sm"
              disabled={busy}
              onClick={() =>
                confirm(t('admin.confirmRevoke', { name: user.name })) &&
                run(async () => {
                  await revokeKeys(user.id);
                  setShown(null);
                })
              }
            >
              {t('admin.revoke')}
            </button>
            <button className="sm" disabled={busy} onClick={() => run(() => updateUser(user.id, { active: !user.active }))}>
              {user.active ? t('admin.deactivate') : t('admin.activate')}
            </button>
            <button className="sm" disabled={busy} onClick={() => run(() => updateUser(user.id, { admin: !user.admin }))}>
              {user.admin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
            </button>
            <button
              className="sm danger"
              disabled={busy}
              onClick={() =>
                confirm(t('admin.confirmRemove', { name: user.name, n: count ?? '?' })) && run(() => removeUser(user.id))
              }
            >
              {t('admin.remove')}
            </button>
          </>
        )}
      </div>
      {shownKey !== undefined && (shownKey ? <KeyBox k={shownKey} /> : <p className="hint">{t('admin.noKey')}</p>)}
    </li>
  );
}

function KeyBox({ k }: { k: string }) {
  const t = useT();
  const link = inviteLink(k);
  const [copied, setCopied] = useState(false);
  return (
    <div className="keybox">
      <code>{k}</code>
      <button
        type="button"
        className="primary"
        onClick={() =>
          navigator.clipboard.writeText(link).then(
            () => setCopied(true),
            () => prompt(t('admin.copyPrompt'), link),
          )
        }
      >
        {copied ? t('admin.copied') : t('admin.copy')}
      </button>
    </div>
  );
}
