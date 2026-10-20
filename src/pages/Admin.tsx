import { useEffect, useState, type FormEvent } from 'react';
import Avatar from '../components/Avatar';
import PageHead from '../components/PageHead';
import { countPoops, createUser, inviteLink, keysFor, regenerateKey, removeUser, revokeKeys, updateUser } from '../data';
import { useSession } from '../session';
import type { User } from '../types';

export default function Admin() {
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
      <PageHead title="Admin" />

      <section className="card">
        <h2>Add person</h2>
        <form onSubmit={onAdd} className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={30} />
          <button className="primary" disabled={busy || !name.trim()}>
            Add
          </button>
        </form>
        {created && (
          <>
            <p className="hint">Send this link to {created.name}:</p>
            <KeyBox k={created.key} />
          </>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>People</h2>
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
            {self && <span className="muted"> (you)</span>}
          </span>
          <span className="tags">
            <span className="lb-sub">{count ?? '–'} logged</span>
            {user.admin && <span className="pill amber">admin</span>}
            {!user.active && <span className="pill danger">inactive</span>}
          </span>
        </span>
      </div>
      <div className="actions">
        <button
          className="sm"
          disabled={busy}
          onClick={() => run(async () => setShown((await keysFor(user.id))[0] ?? null))}
        >
          Key
        </button>
        <button
          className="sm"
          disabled={busy}
          onClick={() =>
            confirm(`Give ${user.name} a new key? The old one stops working.`) &&
            run(async () => setShown(await regenerateKey(user.id)))
          }
        >
          New key
        </button>
        {!self && (
          <>
            <button
              className="sm"
              disabled={busy}
              onClick={() =>
                confirm(`Revoke ${user.name}'s key? They lose access until given a new one.`) &&
                run(async () => {
                  await revokeKeys(user.id);
                  setShown(null);
                })
              }
            >
              Revoke
            </button>
            <button className="sm" disabled={busy} onClick={() => run(() => updateUser(user.id, { active: !user.active }))}>
              {user.active ? 'Deactivate' : 'Activate'}
            </button>
            <button className="sm" disabled={busy} onClick={() => run(() => updateUser(user.id, { admin: !user.admin }))}>
              {user.admin ? 'Remove admin' : 'Make admin'}
            </button>
            <button
              className="sm danger"
              disabled={busy}
              onClick={() =>
                confirm(
                  `Remove ${user.name}? This deletes their key and all ${count ?? 'their'} entries. This cannot be undone.`,
                ) && run(() => removeUser(user.id))
              }
            >
              Remove
            </button>
          </>
        )}
      </div>
      {shownKey !== undefined && (shownKey ? <KeyBox k={shownKey} /> : <p className="hint">No key. Use New key.</p>)}
    </li>
  );
}

function KeyBox({ k }: { k: string }) {
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
            () => prompt('Copy this link:', link),
          )
        }
      >
        {copied ? 'Link copied' : 'Copy invite link'}
      </button>
    </div>
  );
}
