import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar';
import PageHead from '../components/PageHead';
import RecordTile from '../components/RecordTile';
import Segmented from '../components/Segmented';
import { PageSpinner } from '../components/Spinner';
import { fmtMinutes, fmtNum, fmtPts, monthLabel, shortDate, timeOfDay } from '../format';
import { awards, monthStart, netVotes, score, weekStart, type Award, type PeriodKind } from '../game';
import { useT, type Key, type T } from '../i18n';
import { usePoops } from '../poops';
import { categoriesWon, periodEnd, POOP_POINTS, poopPoints, REPORTS_FROM } from '../reports';
import { useReports } from '../reportsProvider';
import { useSession } from '../session';
import { CATEGORIES, periodWinners, type Category, type CategoryWin, type Winners } from '../stats';
import { useSince } from '../useSince';
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

const LABELS: Record<Category, Key> = {
  points: 'top.mostPoints',
  best: 'stats.bestPoop',
  streak: 'stats.longestStreak',
  busiestDay: 'stats.mostInDay',
  earliest: 'stats.earliest',
  latest: 'stats.latest',
  sitter: 'stats.sitter',
};

function categoryValue(c: Category, v: number, t: T): string {
  switch (c) {
    case 'points':
      return fmtPts(v);
    case 'best':
      return fmtNum(v);
    case 'streak':
      return t('common.days', { n: v });
    case 'earliest':
    case 'latest':
      return timeOfDay(new Date(2000, 0, 1, Math.floor(v / 60), v % 60));
    case 'sitter':
      return fmtMinutes(v);
    default:
      return String(v);
  }
}

/** One tile per category with its winners (everyone tied). With `reward`, the poop points each of them got. */
function Categories({ winners, reward }: { winners: Winners; reward?: number }) {
  const t = useT();
  const { users } = useSession();
  const names = (w: CategoryWin) => w.userIds.map((id) => users.get(id)?.name ?? t('common.unknown')).join(', ');
  return (
    <div className="tiles two">
      {CATEGORIES.map((c) => {
        const w = winners[c];
        return (
          <RecordTile
            key={c}
            wide={c === 'points'}
            label={t(LABELS[c])}
            value={w ? categoryValue(c, w.value, t) : null}
            who={w ? names(w) : null}
            extra={w && reward ? `💩 +${reward}` : undefined}
          />
        );
      })}
    </div>
  );
}

interface HallRow {
  start: Date;
  userIds: string[];
  points: number;
  /** Categories won by the points winner (periods with a report). */
  categories?: number;
  /** Entries logged by the winner (older periods, from the history). */
  count?: number;
}

export default function Top() {
  const t = useT();
  const profilePath = useProfilePath();
  const { users } = useSession();
  const reports = useReports();
  const [kind, setKind] = useState<PeriodKind>('week');
  const tabs = [
    { value: 'week' as const, label: t('top.tabWeek') },
    { value: 'month' as const, label: t('top.tabMonth') },
  ];

  const now = new Date();
  const start = (kind === 'week' ? weekStart : monthStart)(now);
  const lastDay = periodEnd(kind, start);
  lastDay.setDate(lastDay.getDate() - 1);
  const label = (d: Date) => (kind === 'week' ? t('top.weekOf', { date: shortDate(d) }) : monthLabel(d));

  // The running period: its own entries only.
  const running = useSince(start);
  const live = useMemo(() => (running.poops?.length ? awards(running.poops, kind)[0] : undefined), [running.poops, kind]);
  const leaders = useMemo(() => (running.poops ? periodWinners(running.poops) : null), [running.poops]);

  // Finished periods: their reports, and for periods before reports existed, winners from the full history.
  const { poops: history, error } = usePoops();
  const mine = useMemo(() => reports?.filter((r) => r.kind === kind) ?? [], [reports, kind]);
  const last = mine[0];
  const hall = useMemo<HallRow[]>(() => {
    const rows: HallRow[] = mine.flatMap((r) => {
      const w = r.winners.points;
      return w ? [{ start: r.start, userIds: w.userIds, points: w.value, categories: categoriesWon(r, w.userIds[0]) }] : [];
    });
    const older = history ? awards(history, kind).filter((a) => a.final && periodEnd(kind, a.start) <= REPORTS_FROM) : [];
    return [...rows, ...older.map((a) => ({ start: a.start, userIds: [a.userId], points: a.points, count: a.count }))];
  }, [mine, history, kind]);

  // Most poop points from this tab's reports.
  const champions = useMemo(() => {
    const ids = new Set(mine.flatMap((r) => Object.values(r.winners).flatMap((w) => w.userIds)));
    return [...ids]
      .map((id) => [id, poopPoints(mine, id)] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [mine]);

  const err = running.error ?? error;
  return (
    <>
      <PageHead title={t('top.title')} />
      <Segmented options={tabs} value={kind} onChange={(v) => v && setKind(v)} variant="pills" />
      {err && <p className="error mt">{err}</p>}
      {!running.poops && !err && <PageSpinner label={t('common.loading')} />}

      {running.poops && (
        <>
          <HeroAward
            award={live}
            title={t(kind === 'week' ? 'top.week' : 'top.month')}
            period={`${t('top.running')} · ${kind === 'week' ? `${shortDate(start)} – ${shortDate(lastDay)}` : monthLabel(start)}`}
          />

          {leaders && running.poops.length > 0 && (
            <section className="card">
              <h2>{t('top.leaders')}</h2>
              <p className="hint card-sub">{t('top.leadersSub', { n: POOP_POINTS[kind] })}</p>
              <Categories winners={leaders} />
            </section>
          )}

          <section className="card">
            <h2>{t(kind === 'week' ? 'top.lastWeek' : 'top.lastMonth')}</h2>
            {last ? (
              <>
                <p className="hint card-sub">{t('top.reportSub', { period: label(last.start), n: POOP_POINTS[kind] })}</p>
                {last.count > 0 ? <Categories winners={last.winners} reward={POOP_POINTS[kind]} /> : <p className="muted">{t('stats.noEntries')}</p>}
              </>
            ) : (
              <p className="muted">{t('top.noReport')}</p>
            )}
          </section>

          {hall.length > 0 && (
            <section className="card">
              <h2>{t('top.hall')}</h2>
              <p className="hint card-sub">{t(kind === 'week' ? 'top.hallSub' : 'top.hallSubMonth')}</p>
              {champions.length > 0 && (
                <div className="champions">
                  {champions.map(([id, n], i) => (
                    <Link key={id} to={profilePath(id)} className={`champion c${i + 1}`}>
                      <Avatar id={id} name={users.get(id)?.name} size={28} />
                      <span>
                        <strong>{users.get(id)?.name ?? t('common.unknown')}</strong>
                        <small title={t('profile.poopPoints')}>💩 {n}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <ol className="lb hall">
                {hall.slice(0, 12).map((a) => {
                  const name = a.userIds.map((id) => users.get(id)?.name ?? t('common.unknown')).join(', ');
                  return (
                    <li key={a.start.getTime()}>
                      <span className="hall-date">{label(a.start)}</span>
                      <Avatar id={a.userIds[0]} name={users.get(a.userIds[0])?.name} size={30} />
                      <Link to={profilePath(a.userIds[0])} className="lb-main">
                        <span className="lb-name">{name}</span>
                        <span className="lb-sub">
                          {a.categories !== undefined ? t('top.categories', { n: a.categories }) : t('admin.logged', { n: a.count ?? 0 })}
                        </span>
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
