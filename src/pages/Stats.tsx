import { useEffect, useMemo, useState } from 'react';
import Avatar from '../components/Avatar';
import BarChart from '../components/BarChart';
import PageHead from '../components/PageHead';
import Segmented from '../components/Segmented';
import { fetchSince } from '../data';
import { timeOfDay } from '../format';
import { useSession } from '../session';
import { computeStats, periodStart, type Period } from '../stats';
import { PLACES, SIZES, TYPES, type Place, type Poop, type Size } from '../types';

const periods = [
  { value: 'week' as const, label: 'Week' },
  { value: 'month' as const, label: 'Month' },
  { value: 'all' as const, label: 'All time' },
];

const fmt = (n: number | null, digits = 1) => (n == null ? '–' : n.toFixed(digits));

export default function Stats() {
  const { me, users } = useSession();
  const [period, setPeriod] = useState<Period>('week');
  const [poops, setPoops] = useState<Poop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useMemo(() => periodStart(period), [period]);

  useEffect(() => {
    let alive = true;
    setPoops(null);
    fetchSince(start)
      .then((p) => alive && setPoops(p))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [start]);

  const s = useMemo(() => (poops ? computeStats(poops, start) : null), [poops, start]);
  const name = (id: string) => users.get(id)?.name ?? 'Unknown';
  const myIndex = s?.ranking.findIndex((r) => r.userId === me?.id) ?? -1;
  const mine = myIndex >= 0 ? s!.ranking[myIndex] : undefined;

  return (
    <>
      <PageHead title="Stats" />
      <Segmented options={periods} value={period} onChange={(v) => v && setPeriod(v)} variant="pills" />

      {error && <p className="error mt">{error}</p>}
      {!s && !error && <p className="muted">Loading</p>}

      {s && (
        <>
          <div className="tiles">
            <div className="tile">
              <span className="tile-value">{s.total}</span>
              <span className="tile-label">Total</span>
            </div>
            <div className="tile">
              <span className="tile-value">{fmt(s.total / s.days)}</span>
              <span className="tile-label">Per day</span>
            </div>
            <div className="tile">
              <span className="tile-value">{myIndex >= 0 ? `#${myIndex + 1}` : '–'}</span>
              <span className="tile-label">Your rank</span>
            </div>
          </div>

          <section className="card">
            <h2>Leaderboard</h2>
            {s.ranking.length === 0 ? (
              <p className="muted">No entries in this period.</p>
            ) : (
              <ol className="lb">
                {s.ranking.map((r, i) => (
                  <li key={r.userId} className={r.userId === me?.id ? 'me' : ''}>
                    <span className={`rank r${i + 1}`}>{i + 1}</span>
                    <Avatar id={r.userId} name={users.get(r.userId)?.name} size={34} />
                    <span className="lb-main">
                      <span className="lb-name">{name(r.userId)}</span>
                      <span className="lb-sub">
                        {fmt(r.perDay)} per day · best streak {r.longestStreak}d
                      </span>
                    </span>
                    <span className="lb-count">{r.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card">
            <h2>You</h2>
            <dl className="kv">
              <dt>Total</dt>
              <dd>{mine?.count ?? 0}</dd>
              <dt>Per day</dt>
              <dd>{fmt(mine?.perDay ?? 0)}</dd>
              <dt>Longest streak</dt>
              <dd>{mine?.longestStreak ?? 0} days</dd>
              <dt>Most in one day</dt>
              <dd>{mine?.maxInDay ?? 0}</dd>
              <dt>Average rating</dt>
              <dd>{fmt(mine?.avgRating ?? null)}</dd>
            </dl>
          </section>

          {s.total > 0 && (
            <>
              <section className="card">
                <h2>Records</h2>
                <div className="tiles two">
                  <Record label="Longest streak" value={s.streak && `${s.streak.days} days`} who={s.streak && name(s.streak.userId)} />
                  <Record label="Most in one day" value={s.busiestDay && String(s.busiestDay.count)} who={s.busiestDay && name(s.busiestDay.userId)} />
                  <Record label="Earliest" value={s.earliest && timeOfDay(s.earliest.at)} who={s.earliest && name(s.earliest.userId)} />
                  <Record label="Latest" value={s.latest && timeOfDay(s.latest.at)} who={s.latest && name(s.latest.userId)} />
                </div>
              </section>

              <section className="card">
                <h2>By hour</h2>
                <BarChart data={s.hours.map((v, h) => ({ label: h % 6 === 0 ? `${h}h` : '', value: v }))} />
              </section>

              <section className="card">
                <h2>Group</h2>
                <dl className="kv">
                  <dt>Average rating</dt>
                  <dd>{fmt(s.avgRating)}</dd>
                  <dt>Average duration</dt>
                  <dd>{s.avgDuration == null ? '–' : `${fmt(s.avgDuration)} min`}</dd>
                </dl>
                <Breakdown
                  title="Type"
                  rows={Object.keys(TYPES).map((t) => [`${t} · ${TYPES[Number(t)]}`, s.types[Number(t)]])}
                  total={s.total}
                />
                <Breakdown
                  title="Size"
                  rows={(Object.keys(SIZES) as Size[]).map((k) => [SIZES[k], s.sizes[k] ?? 0])}
                  total={s.total}
                />
                <Breakdown
                  title="Place"
                  rows={(Object.keys(PLACES) as Place[]).map((k) => [PLACES[k], s.places[k] ?? 0])}
                  total={s.total}
                />
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}

function Record({ label, value, who }: { label: string; value: string | null; who: string | null }) {
  return (
    <div className="tile">
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
