import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { compactDay, timeOfDay } from '../format';
import { score, scoreTier } from '../game';
import { useT, type Key } from '../i18n';
import { useSession } from '../session';
import { timeline } from '../timeline';
import type { Poop } from '../types';
import { useProfilePath } from '../users';
import Avatar from './Avatar';
import ScorePill from './ScorePill';
import Spinner from './Spinner';

const PAGE = 14;
/** Lane colours, readable on both themes. */
const LANE_COLORS = ['#c0703f', '#3f7fbf', '#5f8a6b', '#c0577f', '#d39b2a', '#7a6aa3', '#b5574b', '#2f9c9c', '#8a6f4e', '#6b8e23'];

interface Props {
  poops: Poop[];
  /**
   * Group view: one lane per user id, in this order (like branches in `git log --graph`).
   * Without it, a single rail for one person.
   */
  lanes?: string[];
  /**
   * The caller loads entries in windows: `poops` is all of what is loaded so far, `onMore` fetches
   * older ones when the bottom comes into view. Without it, the days are paged here.
   */
  hasMore?: boolean;
  onMore?: () => void;
}

/** git-log style history: one node per poop, newest first, gaps marked. */
export default function Timeline({ poops, lanes, hasMore: moreToLoad, onMore }: Props) {
  const t = useT();
  const { users } = useSession();
  const [days, setDays] = useState(PAGE);
  const { items, hasMore } = timeline(poops, onMore ? Infinity : days);
  const sentinel = useRef<HTMLDivElement>(null);

  // Load older entries when the bottom of the list comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !onMore || !moreToLoad) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onMore(), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [moreToLoad, onMore]);

  if (items.length === 0 && !moreToLoad) return <p className="muted">{t('profile.noneYet')}</p>;

  const laneOf = new Map(lanes?.map((id, i) => [id, i]));
  // Lane geometry lives in CSS (lanes are narrower on phones): pass the lane count.
  const graph = lanes && ({ '--n': lanes.length } as CSSProperties);

  return (
    <>
      {lanes && (
        <div className="tl-heads" style={graph}>
          <span className="tl-date" />
          <span className="tl-lanes">
            {lanes.map((id, i) => (
              // Staggered on two rows so neighbours don't overlap.
              <span key={id} className={`tl-head${i % 2 ? ' low' : ''}`} style={laneStyle(i, { borderColor: laneColor(i) })} title={users.get(id)?.name}>
                <Avatar id={id} name={users.get(id)?.name} size={22} />
              </span>
            ))}
          </span>
        </div>
      )}
      <ol className={`tl${lanes ? ' tl-graph' : ''}`} style={graph}>
        {items.map((item, idx) =>
          item.kind === 'gap' ? (
            <li key={`gap-${idx}`} className="tl-gap">
              <span className="tl-date" />
              {lanes && (
                <span className="tl-lanes">
                  <Rails count={lanes.length} />
                </span>
              )}
              <span className="tl-gap-label">{t('profile.daysOff', { n: item.days })}</span>
            </li>
          ) : (
            [
              // Group view on phones: the date gets a row of its own (hidden on wider screens).
              lanes && (
                <li key={`day-${idx}`} className="tl-day">
                  <span className="tl-lanes">
                    <Rails count={lanes.length} />
                  </span>
                  <span className="tl-day-label">{compactDay(item.date)}</span>
                </li>
              ),
              ...item.poops.map((p, i) => {
                const lane = laneOf.get(p.userId) ?? 0;
                // tl-later: first row of a day after the first one, which gets some space above.
                return (
                  <li key={p.id} className={`tl-row${i === 0 ? ' tl-first' : ''}${i === 0 && idx > 0 ? ' tl-later' : ''}`}>
                    <span className="tl-date">{i === 0 && compactDay(item.date)}</span>
                    {lanes && (
                      <span className="tl-lanes">
                        <Rails count={lanes.length} />
                        <Node poop={p} style={laneStyle(lane, { background: p.perfect ? undefined : laneColor(lane) })} />
                      </span>
                    )}
                    <Entry poop={p} nameColor={lanes ? laneColor(lane) : undefined} />
                  </li>
                );
              }),
            ]
          ),
        )}
      </ol>
      {onMore && moreToLoad && (
        <div ref={sentinel} className="feed-more muted">
          <Spinner label={t('common.loading')} size="sm" />
        </div>
      )}
      {!onMore && hasMore && (
        <button type="button" className="sm more" onClick={() => setDays((n) => n + PAGE)}>
          {t('common.showMore')}
        </button>
      )}
    </>
  );
}

const laneColor = (i: number) => LANE_COLORS[i % LANE_COLORS.length];
/** Places an element on lane i (see .tl-graph in styles.css). */
const laneStyle = (i: number, extra?: CSSProperties) => ({ '--i': i, ...extra }) as CSSProperties;

/** The vertical line of every lane through one row. */
function Rails({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className="tl-rail" style={laneStyle(i)} />
      ))}
    </>
  );
}

function Node({ poop: p, style }: { poop: Poop; style?: CSSProperties }) {
  const tier = p.perfect ? 'perfect' : scoreTier(score(p));
  return <span className={`tl-node ${tier}`} style={style} aria-hidden />;
}

/** One poop. With `nameColor` (group view) it shows who, in their lane colour, and no node of its own. */
function Entry({ poop: p, nameColor }: { poop: Poop; nameColor?: string }) {
  const showName = nameColor !== undefined;
  const t = useT();
  const { me, users } = useSession();
  const profilePath = useProfilePath();
  const body = (
    <>
      {!showName && <Node poop={p} />}
      <span className="tl-main">
        {/* Group view: CSS shows time first on wide screens, the name on a line of its own on phones. */}
        <span className="tl-line">
          {showName && (
            <strong className="tl-who" style={{ color: nameColor }}>
              {users.get(p.userId)?.name ?? t('common.unknown')}
            </strong>
          )}
          <span className="tl-time num">{timeOfDay(p.at)}</span>
          <strong className="tl-what">{p.perfect ? t('feed.perfect') : t(`type.${p.type}` as Key)}</strong>
          <span className="muted tl-details">
            <span className="tl-sep">{' · '}</span>
            {t(`size.${p.size}` as Key)} · {p.place === 'other' && p.placeNote ? p.placeNote : t(`place.${p.place}` as Key)}
          </span>
        </span>
        {p.note && <span className="tl-note">{p.note}</span>}
      </span>
      <ScorePill poop={p} />
    </>
  );
  // Group view: rows open the person's profile. Personal view: your own rows open the edit page.
  if (showName) return <Link to={profilePath(p.userId)} className="tl-entry">{body}</Link>;
  if (p.userId === me?.id) return <Link to={`/edit/${p.id}`} className="tl-entry">{body}</Link>;
  return <span className="tl-entry">{body}</span>;
}
