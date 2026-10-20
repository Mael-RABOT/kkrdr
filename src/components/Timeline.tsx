import { useState } from 'react';
import { Link } from 'react-router-dom';
import { compactDay, timeOfDay } from '../format';
import { score, scoreTier } from '../game';
import { useT, type Key } from '../i18n';
import { useSession } from '../session';
import { timeline } from '../timeline';
import type { Poop } from '../types';
import ScorePill from './ScorePill';

const PAGE = 14;

/** git-log style history: one node per poop on a rail, newest first, gaps marked. */
export default function Timeline({ poops }: { poops: Poop[] }) {
  const t = useT();
  const [days, setDays] = useState(PAGE);
  const { items, hasMore } = timeline(poops, days);

  if (items.length === 0) return <p className="muted">{t('profile.noneYet')}</p>;

  return (
    <>
      <ol className="tl">
        {items.map((item) =>
          item.kind === 'gap' ? (
            <li key={`gap-${item.days}-${items.indexOf(item)}`} className="tl-gap">
              <span className="tl-date" />
              <span className="tl-gap-label">{t('profile.daysOff', { n: item.days })}</span>
            </li>
          ) : (
            item.poops.map((p, i) => (
              <li key={p.id} className={`tl-row${i === 0 ? ' tl-first' : ''}`}>
                <span className="tl-date">{i === 0 && compactDay(item.date)}</span>
                <Entry poop={p} />
              </li>
            ))
          ),
        )}
      </ol>
      {hasMore && (
        <button type="button" className="sm more" onClick={() => setDays((n) => n + PAGE)}>
          {t('common.showMore')}
        </button>
      )}
    </>
  );
}

function Entry({ poop: p }: { poop: Poop }) {
  const t = useT();
  const { me } = useSession();
  const tier = p.perfect ? 'perfect' : scoreTier(score(p));
  const body = (
    <>
      <span className={`tl-node ${tier}`} aria-hidden />
      <span className="tl-main">
        <span className="tl-line">
          <span className="tl-time num">{timeOfDay(p.at)}</span>
          <strong>{p.perfect ? t('feed.perfect') : t(`type.${p.type}` as Key)}</strong>
          <span className="muted">
            {' · '}
            {t(`size.${p.size}` as Key)} · {p.place === 'other' && p.placeNote ? p.placeNote : t(`place.${p.place}` as Key)}
          </span>
        </span>
        {p.note && <span className="tl-note">{p.note}</span>}
      </span>
      <ScorePill poop={p} />
    </>
  );
  // Your own entries open the edit page.
  return p.userId === me?.id ? (
    <Link to={`/edit/${p.id}`} className="tl-entry">
      {body}
    </Link>
  ) : (
    <span className="tl-entry">{body}</span>
  );
}
