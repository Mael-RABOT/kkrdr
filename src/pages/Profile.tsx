import { useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import LevelBar from '../components/LevelBar';
import PageHead from '../components/PageHead';
import ScorePill from '../components/ScorePill';
import { fmtNum, fmtPts, shortDate } from '../format';
import { BADGES, score } from '../game';
import { useT, type Key } from '../i18n';
import { usePoops } from '../poops';
import { useSession } from '../session';

export default function Profile() {
  const t = useT();
  const { id = '' } = useParams();
  const { me, users } = useSession();
  const { poops, players } = usePoops();
  const user = users.get(id);
  // players is computed from an empty list until the data arrives.
  const p = poops ? players.get(id) : undefined;

  if (!user) return <p className="muted">{t('profile.notFound')}</p>;

  const best = p ? [...p.poops].sort((a, b) => score(b) - score(a)).slice(0, 3) : [];
  const unlocked = BADGES.filter((b) => p?.badges.has(b.id));
  const locked = BADGES.filter((b) => !p?.badges.has(b.id));

  return (
    <>
      <PageHead title={user.name} />
      <section className="card profile-head">
        <Avatar id={id} name={user.name} size={72} />
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
                        {t(`type.${x.type}` as Key)} · {t(`size.${x.size}` as Key)}
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
        </>
      )}
    </>
  );
}
