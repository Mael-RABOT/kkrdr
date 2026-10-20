import { useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAvatar, useRefreshAvatar } from '../avatars';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import LevelBar from '../components/LevelBar';
import PageHead from '../components/PageHead';
import PictureEditor from '../components/PictureEditor';
import ScorePill from '../components/ScorePill';
import Timeline from '../components/Timeline';
import { removeAvatar, setAvatar } from '../data';
import { useDialogs } from '../dialogs';
import { fmtNum, fmtPts, shortDate } from '../format';
import { BADGES, score } from '../game';
import { useT, type Key } from '../i18n';
import { usePoops } from '../poops';
import { useSession } from '../session';
import { findUser, nameKey, useProfilePath } from '../users';

export default function Profile() {
  const t = useT();
  const { name = '' } = useParams();
  const { me, users } = useSession();
  const { poops, players } = usePoops();
  const user = findUser(users, name);
  const id = user?.id ?? '';
  const profilePath = useProfilePath();
  // players is computed from an empty list until the data arrives.
  const p = poops ? players.get(id) : undefined;

  if (!user) return <p className="muted">{t('profile.notFound')}</p>;
  // Old links by id, or another spelling of the name: show the canonical URL.
  if (name !== user.name && nameKey(name) !== nameKey(user.name)) return <Navigate to={profilePath(id)} replace />;

  const best = p ? [...p.poops].sort((a, b) => score(b) - score(a)).slice(0, 3) : [];
  const unlocked = BADGES.filter((b) => p?.badges.has(b.id));
  const locked = BADGES.filter((b) => !p?.badges.has(b.id));

  return (
    <>
      <PageHead title={user.name} />
      <section className="card profile-head">
        <div className="profile-pic">
          <Avatar id={id} name={user.name} size={72} />
          {id === me?.id && <PictureControls userId={id} />}
        </div>
        <div className="profile-main">
          {id === me?.id && <span className="pill amber">{t('common.you')}</span>}
          {p && <LevelBar level={p.level} xp={p.xp} />}
        </div>
      </section>

      {!poops && <p className="muted">{t('common.loading')}</p>}

      {p && (
        <>
          <div className="tiles">
            <div className="tile">
              <span className="tile-value">{fmtPts(p.points)}</span>
              <span className="tile-label">{t('stats.points')}</span>
            </div>
            <div className="tile">
              <span className="tile-value">{fmtNum(p.avgScore)}</span>
              <span className="tile-label">{t('stats.avgScore')}</span>
            </div>
            <div className="tile">
              <span className="tile-value">{p.weekWins + p.monthWins}</span>
              <span className="tile-label">{t('tab.top')}</span>
            </div>
          </div>

          <div className="grid-2">
            <section className="card">
              <h2>
                {t('profile.badges')} <span className="muted h2-sub">{t('profile.badgeCount', { n: unlocked.length, total: BADGES.length })}</span>
              </h2>
              <div className="badges">
                {[...unlocked, ...locked].map((b) => {
                  const has = p.badges.has(b.id);
                  return (
                    <div key={b.id} className={`badge-item${has ? '' : ' locked'}`}>
                      <Badge def={b} locked={!has} />
                      <strong>{t(`badge.${b.id}.name` as Key)}</strong>
                      <small>{t(`badge.${b.id}.desc` as Key)}</small>
                    </div>
                  );
                })}
              </div>
            </section>

            {best.length > 0 && (
              <section className="card">
                <h2>{t('profile.best')}</h2>
                <ol className="lb">
                  {best.map((x, i) => (
                    <li key={x.id}>
                      <span className={`rank r${i + 1}`}>{i + 1}</span>
                      <span className="lb-main">
                        <span className="lb-name">
                          {x.perfect ? t('feed.perfect') : t(`type.${x.type}` as Key)} · {t(`size.${x.size}` as Key)}
                        </span>
                        <span className="lb-sub">
                          {shortDate(x.at)}
                          {x.note ? ` · ${x.note}` : ''}
                        </span>
                      </span>
                      <ScorePill poop={x} />
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="card">
              <h2>{t('profile.numbers')}</h2>
              <dl className="kv">
                <dt>{t('profile.logged')}</dt>
                <dd>{p.count}</dd>
                <dt>{t('stats.longestStreak')}</dt>
                <dd>{t('common.days', { n: p.streak })}</dd>
                <dt>{t('profile.upvotes')}</dt>
                <dd>{p.upvotes}</dd>
                <dt>{t('profile.votesCast')}</dt>
                <dd>{p.votesCast}</dd>
                <dt>{t('profile.weekWins')}</dt>
                <dd>{p.weekWins}</dd>
                <dt>{t('profile.monthWins')}</dt>
                <dd>{p.monthWins}</dd>
              </dl>
            </section>
          </div>

          <section className="card">
            <h2>{t('profile.timeline')}</h2>
            <Timeline poops={p.poops} />
          </section>
        </>
      )}
    </>
  );
}

/** Change or remove your own picture. */
function PictureControls({ userId }: { userId: string }) {
  const t = useT();
  const dialogs = useDialogs();
  const has = useAvatar(userId) !== undefined;
  const refresh = useRefreshAvatar();
  const input = useRef<HTMLInputElement>(null);
  // The photo being framed in the editor.
  const [file, setFile] = useState<File | null>(null);
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  async function save(bytes: Uint8Array, type: string) {
    await setAvatar(userId, bytes, type);
    // Read it back from the server so the page shows what was actually stored.
    await refresh(userId);
    setFile(null);
  }

  async function remove() {
    const ok = await dialogs.confirm({ message: t('profile.removePicConfirm'), confirmLabel: t('profile.removePic'), danger: true });
    if (ok) removeAvatar(userId).then(() => refresh(userId), (e) => dialogs.alert(msg(e)));
  }

  return (
    <div className="pic-controls">
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) setFile(file);
        }}
      />
      <button type="button" className="sm" onClick={() => input.current?.click()}>
        {has ? t('profile.changePic') : t('profile.addPic')}
      </button>
      {file && <PictureEditor file={file} onCancel={() => setFile(null)} onSave={save} />}
      {has && (
        <button type="button" className="link danger" onClick={remove}>
          {t('profile.removePic')}
        </button>
      )}
    </div>
  );
}
