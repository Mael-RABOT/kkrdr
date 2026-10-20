import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import PageHead from '../components/PageHead';
import ScorePill from '../components/ScorePill';
import VoteButtons from '../components/VoteButtons';
import { deletePoop, subscribeRecent, subscribeSince } from '../data';
import { dayKey, dayLabel, fmtPts, relative } from '../format';
import { awards, weekStart } from '../game';
import { useT, type Key } from '../i18n';
import { useSession } from '../session';
import type { Poop } from '../types';

const PAGE = 20;

export default function Feed() {
  const t = useT();
  const { me, users } = useSession();
  const [limit, setLimit] = useState(PAGE);
  const [poops, setPoops] = useState<Poop[] | null>(null);
  const [week, setWeek] = useState<Poop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  const navigate = useNavigate();
  const sentinel = useRef<HTMLDivElement>(null);

  // Newest `limit` entries; the limit grows as you scroll (already loaded ones come from the local cache).
  useEffect(() => subscribeRecent(limit, setPoops, (e) => setError(e.message)), [limit]);
  // This week's entries, for the leader banner.
  useEffect(() => subscribeSince(weekStart(new Date()), setWeek, () => {}), []);

  const hasMore = poops !== null && poops.length >= limit;

  // Load the next page when the bottom of the list comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => (poops && poops.length >= n ? n + PAGE : n));
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, poops]);

  // Refresh relative times every minute.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const leader = useMemo(() => (week?.length ? awards(week, 'week')[0] : undefined), [week]);

  function remove(p: Poop) {
    if (!confirm(t('feed.confirmDelete'))) return;
    deletePoop(p.id).catch((e) => alert(e instanceof Error ? e.message : String(e)));
  }

  let lastDay = '';
  return (
    <>
      <PageHead title={t('feed.title')} />
      {error && <p className="error">{error}</p>}
      {!poops && !error && <p className="muted">{t('common.loading')}</p>}

      {leader && (
        <Link to="/top" className="leader-banner">
          <Avatar id={leader.userId} name={users.get(leader.userId)?.name} size={36} />
          <span className="leader-text">
            <span className="leader-label">{t('feed.weekLeader')}</span>
            <strong>{users.get(leader.userId)?.name ?? t('common.unknown')}</strong>
          </span>
          <span className="leader-score">
            {fmtPts(leader.points)}
            <small> {t('common.points')}</small>
          </span>
        </Link>
      )}

      {poops?.length === 0 && (
        <div className="card empty">
          <p className="muted">{t('feed.empty')}</p>
          <button className="primary" onClick={() => navigate('/new')}>
            {t('feed.logFirst')}
          </button>
        </div>
      )}

      <ul className="feed">
        {poops?.map((p) => {
          const k = dayKey(p.at);
          const header =
            k !== lastDay ? (
              <li key={'day-' + k} className="day">
                {dayLabel(p.at)}
              </li>
            ) : null;
          lastDay = k;
          const name = users.get(p.userId)?.name;
          const placeLabel = t(`place.${p.place}` as Key);
          const place = p.place === 'other' && p.placeNote ? p.placeNote : placeLabel + (p.placeNote ? ` · ${p.placeNote}` : '');
          return [
            header,
            <li key={p.id} className="entry">
              <Link to={`/u/${p.userId}`} className="entry-avatar">
                <Avatar id={p.userId} name={name} />
              </Link>
              <div className="entry-body">
                <div className="entry-top">
                  <Link to={`/u/${p.userId}`} className="entry-name">
                    {name ?? t('common.unknown')}
                  </Link>
                  <span className="muted">{relative(p.at)}</span>
                </div>
                <div className="tags">
                  <span className="pill">{t(`type.${p.type}` as Key)}</span>
                  <span className="pill">{t(`size.${p.size}` as Key)}</span>
                  <span className="pill">{place}</span>
                  {p.duration != null && <span className="pill">{t('feed.min', { n: p.duration })}</span>}
                  {p.rating != null && <span className="pill amber">{p.rating}/5</span>}
                </div>
                {p.note && <p className="note">{p.note}</p>}
                <div className="entry-foot">
                  <ScorePill poop={p} />
                  <VoteButtons poop={p} />
                  {p.userId === me?.id && (
                    <button className="link danger" onClick={() => remove(p)}>
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
            </li>,
          ];
        })}
      </ul>
      {hasMore && (
        <div ref={sentinel} className="feed-more muted">
          {t('common.loading')}
        </div>
      )}
    </>
  );
}
