import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar';
import PageHead from '../components/PageHead';
import { PageSpinner } from '../components/Spinner';
import { fmtNum, fmtPts, monthLabel, shortDate } from '../format';
import { awards, monthStart, netVotes, score, weekStart, type Award } from '../game';
import { useT, type Key } from '../i18n';
import { usePoops } from '../poops';
import { useSession } from '../session';
import { useProfilePath } from '../users';

function Trophy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M7 3h10v3h3v2a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V6h3V3zm0 5H6a2 2 0 0 0 1 1.7V8zm10 0v1.7A2 2 0 0 0 18 8h-1z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeroAward({ award, title, period }: { award: Award | undefined; title: string; period: string }) {
  const t = useT();
  const profilePath = useProfilePath();
  const { users } = useSession();
  const p = award?.poop;
  const name = award ? (users.get(award.userId)?.name ?? t('common.unknown')) : '';
  return (
    <section className={`hero${award?.final ? ' final' : ''}`}>
      <div className="hero-head">
        <Trophy />
        <span className="hero-titles">
          <span className="hero-title">{title}</span>
          <span className="hero-period">{period}</span>
        </span>
      </div>
      {award && p ? (
        <Link to={profilePath(award.userId)} className="hero-body">
          <Avatar id={award.userId} name={name} size={64} />
          <span className="hero-main">
            <strong className="hero-name">{name}</strong>
            <span className="hero-tags">{t('admin.logged', { n: award.count })}</span>
            <span className="hero-note">
              {t('top.bestPoop', { type: p.perfect ? t('feed.perfect') : t(`type.${p.type}` as Key), score: fmtNum(score(p)) })}
              {netVotes(p) !== 0 && ` · ${netVotes(p) > 0 ? '+' : ''}${netVotes(p)}`}
            </span>
          </span>
          <span className="hero-score">
            {fmtPts(award.points)}
            <small>{t('common.points')}</small>
          </span>
        </Link>
      ) : (
        <p className="hero-empty">{t('top.none')}</p>
      )}
    </section>
  );
}

function SmallAward({ award, label }: { award: Award; label: string }) {
  const t = useT();
  const profilePath = useProfilePath();
  const { users } = useSession();
  const name = users.get(award.userId)?.name ?? t('common.unknown');
  return (
    <Link to={profilePath(award.userId)} className="tile small-award">
      <span className="tile-label">{label}</span>
      <span className="small-award-row">
        <Avatar id={award.userId} name={name} size={28} />
        <span className="lb-name">{name}</span>
        <span className="small-award-score">{fmtPts(award.points)}</span>
      </span>
    </Link>
  );
}

export default function Top() {
  const t = useT();
  const profilePath = useProfilePath();
  const { users } = useSession();
  const { poops, error } = usePoops();

  const weeks = useMemo(() => (poops ? awards(poops, 'week') : []), [poops]);
  const months = useMemo(() => (poops ? awards(poops, 'month') : []), [poops]);

  const now = new Date();
  const thisWeek = weeks[0] && !weeks[0].final ? weeks[0] : undefined;
  const thisMonth = months[0] && !months[0].final ? months[0] : undefined;
  const pastWeeks = weeks.filter((a) => a.final);
  const pastMonths = months.filter((a) => a.final);

  const weekEnd = new Date(weekStart(now));
  weekEnd.setDate(weekEnd.getDate() + 6);

  const winCounts = new Map<string, number>();
  for (const a of pastWeeks) winCounts.set(a.userId, (winCounts.get(a.userId) ?? 0) + 1);
  const champions = [...winCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <>
      <PageHead title={t('top.title')} />
      {error && <p className="error">{error}</p>}
      {!poops && !error && <PageSpinner label={t('common.loading')} />}

      {poops && (
        <>
          <div className="grid-2">
            <HeroAward
              award={thisWeek}
              title={t('top.week')}
              period={`${t('top.running')} · ${shortDate(weekStart(now))} – ${shortDate(weekEnd)}`}
            />
            <HeroAward award={thisMonth} title={t('top.month')} period={`${t('top.running')} · ${monthLabel(monthStart(now))}`} />
          </div>

          {(pastWeeks[0] || pastMonths[0]) && (
            <div className="tiles two awards-last">
              {pastWeeks[0] && <SmallAward award={pastWeeks[0]} label={t('top.lastWeek')} />}
              {pastMonths[0] && <SmallAward award={pastMonths[0]} label={t('top.lastMonth')} />}
            </div>
          )}

          {pastWeeks.length > 0 && (
            <section className="card">
              <h2>{t('top.hall')}</h2>
              <p className="hint card-sub">{t('top.hallSub')}</p>
              {champions.length > 0 && (
                <div className="champions">
                  {champions.map(([id, n], i) => (
                    <Link key={id} to={profilePath(id)} className={`champion c${i + 1}`}>
                      <Avatar id={id} name={users.get(id)?.name} size={28} />
                      <span>
                        <strong>{users.get(id)?.name ?? t('common.unknown')}</strong>
                        <small>{t('top.wins', { n })}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <ol className="lb hall">
                {pastWeeks.slice(0, 12).map((a) => {
                  const name = users.get(a.userId)?.name ?? t('common.unknown');
                  return (
                    <li key={a.start.getTime()}>
                      <span className="hall-date">{t('top.weekOf', { date: shortDate(a.start) })}</span>
                      <Avatar id={a.userId} name={name} size={30} />
                      <Link to={profilePath(a.userId)} className="lb-main">
                        <span className="lb-name">{name}</span>
                        <span className="lb-sub">{t('admin.logged', { n: a.count })}</span>
                      </Link>
                      <span className="lb-count">
                        {fmtPts(a.points)}
                        <small> {t('common.points')}</small>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </>
      )}
    </>
  );
}
