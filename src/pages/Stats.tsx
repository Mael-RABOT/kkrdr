import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar';
import BarChart from '../components/BarChart';
import PageHead from '../components/PageHead';
import Segmented from '../components/Segmented';
import { fmtNum, fmtPts, timeOfDay } from '../format';
import { score } from '../game';
import { useT, type Key } from '../i18n';
import { usePoops } from '../poops';
import { useSession } from '../session';
import { useProfilePath } from '../users';
import { computeStats, periodStart, type Period } from '../stats';
import { PLACE_IDS, SIZE_IDS, TYPE_IDS } from '../types';

const fmt = (n: number | null, digits = 1) => fmtNum(n, digits);

export default function Stats() {
  const t = useT();
  const profilePath = useProfilePath();
  const { me, users } = useSession();
  const { poops: all, error } = usePoops();
  const [period, setPeriod] = useState<Period>('week');
  const periods = [
    { value: 'week' as const, label: t('stats.week') },
    { value: 'month' as const, label: t('stats.month') },
    { value: 'all' as const, label: t('stats.all') },
  ];

  const start = useMemo(() => periodStart(period), [period]);
  const poops = useMemo(() => (all && start ? all.filter((p) => p.at >= start) : all), [all, start]);
  const s = useMemo(() => (poops ? computeStats(poops, start) : null), [poops, start]);
  const name = (id: string) => users.get(id)?.name ?? t('common.unknown');
  const myIndex = s?.ranking.findIndex((r) => r.userId === me?.id) ?? -1;
  const mine = myIndex >= 0 ? s!.ranking[myIndex] : undefined;

  return (
    <>
      <PageHead title={t('stats.title')} />
      <Segmented options={periods} value={period} onChange={(v) => v && setPeriod(v)} variant="pills" />

      {error && <p className="error mt">{error}</p>}
      {!s && !error && <p className="muted">{t('common.loading')}</p>}

      {s && (
        <>
          <div className="tiles">
            <div className="tile">
              <span className="tile-value">{s.total}</span>
              <span className="tile-label">{t('stats.total')}</span>
            </div>
            <div className="tile">
              <span className="tile-value">{fmt(s.total / s.days)}</span>
              <span className="tile-label">{t('stats.perDay')}</span>
            </div>
            <div className="tile">
              <span className="tile-value">{mine ? `#${mine.rank}` : '–'}</span>
              <span className="tile-label">{t('stats.yourRank')}</span>
            </div>
          </div>

          <div className="grid-2">
            <section className="card">
              <h2>{t('stats.leaderboard')}</h2>
              <p className="hint card-sub">{t('stats.lbHint')}</p>
              {s.ranking.length === 0 ? (
                <p className="muted">{t('stats.noEntries')}</p>
              ) : (
                <ol className="lb">
                  {s.ranking.map((r, i) => (
                    <li key={r.userId} className={r.userId === me?.id ? 'me' : ''}>
                      <span className={`rank r${r.rank}`}>{r.rank}</span>
                      <Avatar id={r.userId} name={users.get(r.userId)?.name} size={34} />
                      <Link to={profilePath(r.userId)} className="lb-main">
                        <span className="lb-name">{name(r.userId)}</span>
                        <span className="lb-sub">{t('stats.rowSub', { count: r.count, avg: fmt(r.avgScore) })}</span>
                        {r.tie && <span className="lb-tie">{t(`stats.tie.${r.tie}`, { name: name(s.ranking[i - 1].userId) })}</span>}
                      </Link>
                      <span className="lb-count">
                        {fmtPts(r.points)}
                        <small> {t('common.points')}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="card">
              <h2>{t('stats.you')}</h2>
              <dl className="kv">
                <dt>{t('stats.points')}</dt>
                <dd>{fmtPts(mine?.points ?? 0)}</dd>
                <dt>{t('stats.avgScore')}</dt>
                <dd>{fmt(mine?.avgScore ?? null)}</dd>
                <dt>{t('stats.total')}</dt>
                <dd>{mine?.count ?? 0}</dd>
                <dt>{t('stats.perDay')}</dt>
                <dd>{fmt(mine?.perDay ?? 0)}</dd>
                <dt>{t('stats.longestStreak')}</dt>
                <dd>{t('common.days', { n: mine?.longestStreak ?? 0 })}</dd>
                <dt>{t('stats.mostInDay')}</dt>
                <dd>{mine?.maxInDay ?? 0}</dd>
              </dl>
            </section>

            {s.total > 0 && (
              <>
                <section className="card">
                  <h2>{t('stats.records')}</h2>
                  <div className="tiles two">
                    <Record wide label={t('stats.bestPoop')} value={s.best && fmtNum(score(s.best))} who={s.best && name(s.best.userId)} />
                    <Record label={t('stats.longestStreak')} value={s.streak && t('common.days', { n: s.streak.days })} who={s.streak && name(s.streak.userId)} />
                    <Record label={t('stats.mostInDay')} value={s.busiestDay && String(s.busiestDay.count)} who={s.busiestDay && name(s.busiestDay.userId)} />
                    <Record label={t('stats.earliest')} value={s.earliest && timeOfDay(s.earliest.at)} who={s.earliest && name(s.earliest.userId)} />
                    <Record label={t('stats.latest')} value={s.latest && timeOfDay(s.latest.at)} who={s.latest && name(s.latest.userId)} />
                  </div>
                </section>

                <section className="card">
                  <h2>{t('stats.byHour')}</h2>
                  <BarChart data={s.hours.map((v, h) => ({ label: h % 6 === 0 ? `${h}h` : '', value: v }))} />
                </section>

                <section className="card">
                  <h2>{t('stats.group')}</h2>
                  <dl className="kv">
                    <dt>{t('stats.avgRating')}</dt>
                    <dd>{fmt(s.avgRating)}</dd>
                    <dt>{t('stats.avgDuration')}</dt>
                    <dd>{s.avgDuration == null ? '–' : t('feed.min', { n: fmt(s.avgDuration) })}</dd>
                  </dl>
                  <Breakdown
                    title={t('log.type')}
                    rows={TYPE_IDS.map((n) => [`${n} · ${t(`type.${n}` as Key)}`, s.types[n]])}
                    total={s.total}
                  />
                  <Breakdown
                    title={t('log.size')}
                    rows={SIZE_IDS.map((k) => [t(`size.${k}` as Key), s.sizes[k] ?? 0])}
                    total={s.total}
                  />
                  <Breakdown
                    title={t('log.where')}
                    rows={PLACE_IDS.map((k) => [t(`place.${k}` as Key), s.places[k] ?? 0])}
                    total={s.total}
                  />
                </section>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Record({ label, value, who, wide }: { label: string; value: string | null; who: string | null; wide?: boolean }) {
  return (
    <div className={`tile${wide ? ' wide' : ''}`}>
      <span className="tile-value">{value ?? '–'}</span>
      <span className="tile-label">{label}</span>
      {who && <span className="tile-sub">{who}</span>}
    </div>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div className="breakdown">
      <h3>{title}</h3>
      {rows
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([label, v]) => (
          <div key={label} className="hbar">
            <span className="hbar-label">{label}</span>
            <span className="hbar-track">
              <span className="hbar-fill" style={{ width: `${(v / total) * 100}%` }} />
            </span>
            <span className="hbar-value">{v}</span>
          </div>
        ))}
    </div>
  );
}
