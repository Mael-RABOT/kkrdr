import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import PageHead from '../components/PageHead';
import PoopDetail, { placeText } from '../components/PoopDetail';
import ScorePill from '../components/ScorePill';
import Segmented from '../components/Segmented';
import VoteButtons from '../components/VoteButtons';
import { deletePoop, subscribeRecent, subscribeSince, type FeedSort } from '../data';
import { dayKey, dayLabel, fmtPts, relative } from '../format';
import { awards, weekStart } from '../game';
import { useDialogs } from '../dialogs';
import { useT, type Key } from '../i18n';
import { readPref, writePref } from '../prefs';
import { useSession } from '../session';
import { useProfilePath } from '../users';
import type { Poop } from '../types';

const PAGE = 20;

export default function Feed() {
  const t = useT();
  const profilePath = useProfilePath();
  const dialogs = useDialogs();
  const { me, users } = useSession();
  const [sort, setSortState] = useState<FeedSort>(() => (readPref('feedSort') === 'createdAt' ? 'createdAt' : 'at'));
  const [limit, setLimit] = useState(PAGE);
  const [poops, setPoops] = useState<Poop[] | null>(null);
  const [week, setWeek] = useState<Poop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  // The entry open in the popup; looked up in the live list so votes update in place.
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? poops?.find((p) => p.id === openId) : undefined;
  const navigate = useNavigate();
  const sentinel = useRef<HTMLDivElement>(null);

  // Newest `limit` entries; the limit grows as you scroll (already loaded ones come from the local cache).
  useEffect(() => subscribeRecent(limit, sort, setPoops, (e) => setError(e.message)), [limit, sort]);
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

  const sortOptions = [
    { value: 'at' as const, label: t('feed.sortAt') },
    { value: 'createdAt' as const, label: t('feed.sortPosted') },
  ];

  function setSort(v: FeedSort) {
    if (v === sort) return;
    setSortState(v);
    writePref('feedSort', v);
    setLimit(PAGE);
    setPoops(null);
  }

  async function remove(p: Poop) {
    const ok = await dialogs.confirm({ title: t('feed.deleteTitle'), message: t('feed.confirmDelete'), confirmLabel: t('common.delete'), danger: true });
    if (!ok) return;
    deletePoop(p.id).catch((e) => dialogs.alert(e instanceof Error ? e.message : String(e)));
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

      <Segmented options={sortOptions} value={sort} onChange={(v) => v && setSort(v)} variant="pills" />

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
          // Day headers follow the sort field.
          const when = sort === 'createdAt' ? (p.createdAt ?? p.at) : p.at;
          const k = dayKey(when);
          const header =
            k !== lastDay ? (
              <li key={'day-' + k} className="day">
                {dayLabel(when)}
              </li>
            ) : null;
          lastDay = k;
          const name = users.get(p.userId)?.name;
          const place = placeText(p, t);
          return [
            header,
            <li
              key={p.id}
              className={`entry clickable${p.perfect ? ' perfect' : ''}`}
              // Links and buttons inside keep their own action.
              onClick={(e) => !(e.target as HTMLElement).closest('a, button') && setOpenId(p.id)}
            >
              <Link to={profilePath(p.userId)} className="entry-avatar">
                <Avatar id={p.userId} name={name} />
              </Link>
              <div className="entry-body">
                <div className="entry-top">
                  <Link to={profilePath(p.userId)} className="entry-name">
                    {name ?? t('common.unknown')}
                  </Link>
                  <span className="entry-time muted">
                    {relative(p.at)}
                    {sort === 'createdAt' && p.createdAt && (
                      <small>{t('feed.posted', { when: relative(p.createdAt) })}</small>
                    )}
                  </span>
                </div>
                <div className="tags">
                  {p.perfect ? (
                    <span className="pill perfect">{t('feed.perfect')}</span>
                  ) : (
                    <span className="pill">{t(`type.${p.type}` as Key)}</span>
                  )}
                  <span className="pill">{t(`size.${p.size}` as Key)}</span>
                  <span className="pill">{place}</span>
                  {p.duration != null && <span className="pill">{t('feed.min', { n: p.duration })}</span>}
                  {p.rating != null && !p.perfect && <span className="pill amber">{p.rating}/5</span>}
                </div>
                {p.note && <p className="note">{p.note}</p>}
                <div className="entry-foot">
                  <ScorePill poop={p} />
                  <VoteButtons poop={p} />
                  {p.userId === me?.id && (
                    <span className="entry-actions">
                      <Link to={`/edit/${p.id}`} className="link-btn">
                        {t('common.edit')}
                      </Link>
                      <button className="link danger" onClick={() => remove(p)}>
                        {t('common.delete')}
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </li>,
          ];
        })}
      </ul>
      {open && <PoopDetail poop={open} onClose={() => setOpenId(null)} />}
      {hasMore && (
        <div ref={sentinel} className="feed-more muted">
          {t('common.loading')}
        </div>
      )}
    </>
  );
}
