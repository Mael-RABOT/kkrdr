import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import BarChart from '../components/BarChart';
import Spinner from '../components/Spinner';
import UserTitle from '../components/UserTitle';
import { fmtMinutes, fmtNum, fmtPts, monthLabel, shortDate, timeOfDay, weekdayName } from '../format';
import { netVotes, score } from '../game';
import { useT, type Key } from '../i18n';
import { usePoops } from '../poops';
import { useReports } from '../reportsProvider';
import { useSession } from '../session';
import { CATEGORY_LABELS } from '../stats';
import type { Poop } from '../types';
import { computeWrap, lastMonth, monthKey, parseMonthKey, wrapMonths, type Compare, type Wrap as WrapData, type WrapCard } from '../wrap';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** A number going from 0 to `value` (ease-out), replayed whenever the card is shown. */
function useCountUp(value: number, ms = 900) {
  const [v, setV] = useState(() => (reducedMotion() ? value : 0));
  useEffect(() => {
    if (reducedMotion()) return setV(value);
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(value * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

function Num({ value, format = (n) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}

const hourLabel = (h: number) => timeOfDay(new Date(2000, 0, 1, h));
const poopName = (p: Poop, t: ReturnType<typeof useT>) => (p.perfect ? t('feed.perfect') : t(`type.${p.type}` as Key));

/** You, the average and the leader as bars, the rank, and a line saying how it went. */
function Versus({ cmp, format }: { cmp: Compare; format: (n: number) => string }) {
  const t = useT();
  const { me, users } = useSession();
  const rows: [string, number, boolean][] = [
    [t('wrap.you'), cmp.mine, true],
    [t('wrap.groupAvg'), cmp.avg, false],
  ];
  if (cmp.leader.userId !== me?.id) rows.push([`${t('wrap.best')} · ${users.get(cmp.leader.userId)?.name ?? t('common.unknown')}`, cmp.leader.value, false]);
  const max = Math.max(...rows.map((r) => r[1]), 1e-9);
  const pct = cmp.avg > 0 ? Math.round(((cmp.mine - cmp.avg) / cmp.avg) * 100) : 0;
  const line =
    cmp.of === 1
      ? t('wrap.cmp.alone')
      : cmp.rank === 1
        ? t('wrap.cmp.top')
        : Math.abs(pct) < 5
          ? t('wrap.cmp.even')
          : t(pct > 0 ? 'wrap.cmp.above' : 'wrap.cmp.below', { n: Math.abs(pct) });
  return (
    <div className="wrap-vs">
      {cmp.of > 1 && <span className="wrap-rank">{t('wrap.rank', { rank: cmp.rank, of: cmp.of })}</span>}
      {rows.map(([label, v, you]) => (
        <div key={label} className={`wrap-vs-row${you ? ' you' : ''}`}>
          <span className="wrap-vs-label">{label}</span>
          <span className="wrap-vs-track">
            <span className="wrap-vs-fill" style={{ width: `${(v / max) * 100}%` }} />
          </span>
          <span className="wrap-vs-value">{format(v)}</span>
        </div>
      ))}
      <p className="wrap-line">{line}</p>
    </div>
  );
}

function Delta({ now, prev, format }: { now: number; prev: number; format: (n: number) => string }) {
  const t = useT();
  const d = now - prev;
  const text = prev === 0 ? t('wrap.delta.new') : Math.abs(d) < 1e-9 ? t('wrap.delta.same') : t(d > 0 ? 'wrap.delta.up' : 'wrap.delta.down', { n: format(Math.abs(d)) });
  return <span className={`wrap-delta${d > 0 ? ' up' : d < 0 ? ' down' : ''}`}>{text}</span>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="wrap-stat">
      <strong>
        <Num value={value} />
      </strong>
      <span>{label}</span>
    </div>
  );
}

function Big({ children, unit }: { children: ReactNode; unit?: string }) {
  return (
    <div className="wrap-big">
      <span className="wrap-big-value">{children}</span>
      {unit && <span className="wrap-big-unit">{unit}</span>}
    </div>
  );
}

const int = (n: number) => String(Math.round(n));
const mins = (n: number) => fmtMinutes(Math.round(n));

/** What one card shows; the frame (background, progress, taps) is the viewer's. */
function CardBody({ card, wrap, months, onReplay }: { card: WrapCard; wrap: WrapData; months: Date[]; onReplay: () => void }) {
  const t = useT();
  const { me, users } = useSession();
  const name = (id: string) => users.get(id)?.name ?? t('common.unknown');
  const month = monthLabel(wrap.month);

  switch (card.id) {
    case 'intro': {
      const i = months.findIndex((m) => m.getTime() === wrap.month.getTime());
      const before = i >= 0 ? months[i - 1] : [...months].reverse().find((m) => m < wrap.month);
      const after = i >= 0 ? months[i + 1] : months.find((m) => m > wrap.month);
      return (
        <>
          <p className="wrap-kicker">{t('wrap.kicker')}</p>
          {me && <Avatar id={me.id} name={me.name} size={96} />}
          {me && <UserTitle userId={me.id} />}
          <div className="wrap-months">
            {before ? (
              <Link to={`/wrap/${monthKey(before)}`} replace aria-label={t('wrap.prevMonth')}>
                ‹
              </Link>
            ) : (
              <span />
            )}
            <h1 className="wrap-title">{t('wrap.title', { month })}</h1>
            {after ? (
              <Link to={`/wrap/${monthKey(after)}`} replace aria-label={t('wrap.nextMonth')}>
                ›
              </Link>
            ) : (
              <span />
            )}
          </div>
          <p className="wrap-line">{wrap.count ? t('wrap.intro') : t('wrap.empty')}</p>
          {wrap.count > 0 && <p className="wrap-hint">{t('wrap.tap')}</p>}
        </>
      );
    }
    case 'count':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.count.title')}</p>
          <Big unit={t('wrap.count.unit', { n: card.cmp.mine })}>
            <Num value={card.cmp.mine} />
          </Big>
          <Delta now={card.cmp.mine} prev={card.prev} format={int} />
          <Versus cmp={card.cmp} format={(n) => fmtNum(n, Number.isInteger(n) ? 0 : 1)} />
        </>
      );
    case 'rhythm':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.rhythm.title')}</p>
          <Big unit={t('wrap.rhythm.perDay')}>
            <Num value={card.perDay} format={(n) => fmtNum(n)} />
          </Big>
          <p className="wrap-line">{t('wrap.rhythm.max', { n: card.maxInDay, date: shortDate(card.maxDay) })}</p>
          <p className="wrap-line">{card.daysOff ? t('wrap.rhythm.off', { n: card.daysOff, days: card.days }) : t('wrap.rhythm.noOff')}</p>
        </>
      );
    case 'streak':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.streak.title')}</p>
          <Big unit={t('wrap.streak.unit', { n: card.cmp.mine })}>
            <Num value={card.cmp.mine} />
          </Big>
          <Versus cmp={card.cmp} format={(n) => t('common.days', { n: Math.round(n * 10) / 10 })} />
        </>
      );
    case 'points':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.points.title')}</p>
          <Big unit={t('common.points')}>
            <Num value={card.points.mine} format={(n) => fmtPts(Math.round(n * 2) / 2)} />
          </Big>
          <Delta now={card.points.mine} prev={card.prev} format={fmtPts} />
          <Versus cmp={card.points} format={(n) => fmtNum(n, Number.isInteger(n) ? 0 : 1)} />
          <p className="wrap-sub">{t('wrap.points.avg')}</p>
          <Versus cmp={card.avgScore} format={(n) => fmtNum(n)} />
        </>
      );
    case 'best':
    case 'worst': {
      const p = card.poop;
      const votes = netVotes(p);
      return (
        <>
          <p className="wrap-kicker">{t(card.id === 'best' ? 'wrap.best.title' : 'wrap.worst.title')}</p>
          <Big unit={t('common.score')}>
            <Num value={score(p)} format={(n) => fmtNum(n)} />
          </Big>
          <p className="wrap-line">{t('wrap.best.sub', { type: poopName(p, t), size: t(`size.${p.size}` as Key), date: shortDate(p.at) })}</p>
          {votes !== 0 && <span className="wrap-chip">{t('wrap.votes', { n: votes > 0 ? `+${votes}` : votes })}</span>}
          {p.note && <blockquote className="wrap-quote">“{p.note}”</blockquote>}
        </>
      );
    }
    case 'type':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.type.title')}</p>
          <h2 className="wrap-persona">{t(`wrap.persona.type.${card.type}` as Key)}</h2>
          <p className="wrap-line">{t('wrap.type.share', { n: Math.round(card.share * 100), type: `${card.type} · ${t(`type.${card.type}` as Key)}` })}</p>
          <BarChart data={card.types.slice(1).map((v, i) => ({ label: String(i + 1), value: v }))} height={90} />
        </>
      );
    case 'clock':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.clock.title')}</p>
          <h2 className="wrap-persona">{t(`wrap.persona.time.${card.persona}` as Key)}</h2>
          <p className="wrap-line">{t('wrap.clock.hour', { h: hourLabel(card.hour) })}</p>
          <BarChart data={card.hours.map((v, h) => ({ label: h % 6 === 0 ? `${h}h` : '', value: v }))} height={90} />
          <p className="wrap-sub">{t('wrap.clock.range', { early: timeOfDay(card.earliest), late: timeOfDay(card.latest) })}</p>
        </>
      );
    case 'weekday':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.weekday.title')}</p>
          <h2 className="wrap-persona">{t('wrap.weekday.line', { day: weekdayName(card.day) })}</h2>
          <BarChart data={card.days.map((v, i) => ({ label: weekdayName(i).slice(0, 2), value: v }))} height={90} />
        </>
      );
    case 'places':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.places.title')}</p>
          <h2 className="wrap-persona">{t(`place.${card.place}` as Key)}</h2>
          <p className="wrap-line">{t('wrap.places.share', { n: Math.round(card.share * 100) })}</p>
          <p className="wrap-line">
            {card.workMinutes
              ? t('wrap.places.work', { time: fmtMinutes(card.workMinutes) })
              : card.workCount
                ? t('wrap.places.workCount', { n: card.workCount })
                : t('wrap.places.workNone')}
          </p>
          <span className="wrap-chip">{t('wrap.places.kinds', { n: card.kinds })}</span>
        </>
      );
    case 'throne': {
      const m = card.cmp.mine;
      return (
        <>
          <p className="wrap-kicker">{t('wrap.throne.title')}</p>
          <Big>
            <Num value={m} format={mins} />
          </Big>
          <p className="wrap-line">{m >= 60 ? t('wrap.throne.episodes', { n: Math.round(m / 22) }) : t('wrap.throne.songs', { n: Math.max(1, Math.round(m / 3.5)) })}</p>
          <p className="wrap-sub">{t('wrap.throne.longest', { time: fmtMinutes(card.longest) })}</p>
          <Versus cmp={card.cmp} format={mins} />
        </>
      );
    }
    case 'size':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.size.title')}</p>
          {card.xl ? (
            <Big unit={t('wrap.size.xl', { n: card.xl })}>
              <Num value={card.xl} />
            </Big>
          ) : (
            <h2 className="wrap-persona">{t('wrap.size.xlNone')}</h2>
          )}
          <p className="wrap-line">{t('wrap.size.main', { size: t(`size.${card.size}` as Key).toLowerCase() })}</p>
          {card.perfect > 0 && <p className="wrap-line">{t('wrap.size.perfect', { n: card.perfect })}</p>}
          {card.rareColor && <span className="wrap-chip">{t('wrap.size.color', { color: t(`color.${card.rareColor}` as Key) })}</span>}
        </>
      );
    case 'social':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.social.title')}</p>
          <div className="wrap-stats">
            <Stat value={card.up} label={t('wrap.social.up')} />
            <Stat value={card.down} label={t('wrap.social.down')} />
            <Stat value={card.comments} label={t('wrap.social.comments')} />
          </div>
          {card.mostCommented && (
            <p className="wrap-line">{t('wrap.social.most', { date: shortDate(card.mostCommented.at), n: card.mostCommented.commentCount ?? 0 })}</p>
          )}
          <p className="wrap-sub">{t('wrap.social.cast')}</p>
          <Versus cmp={card.cast} format={int} />
        </>
      );
    case 'media':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.media.title')}</p>
          <div className="wrap-stats">
            <Stat value={card.photos} label={t('wrap.media.photos')} />
            <Stat value={card.gifs} label={t('wrap.media.gifs')} />
            <Stat value={card.sounds} label={t('wrap.media.sounds')} />
          </div>
          {card.soundSecs > 0 && <p className="wrap-line">{t('wrap.media.secs', { n: card.soundSecs })}</p>}
        </>
      );
    case 'soulmate':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.soulmate.title')}</p>
          <div className="wrap-pair">
            {me && <Avatar id={me.id} name={me.name} size={72} />}
            <span aria-hidden>💞</span>
            <Avatar id={card.userId} name={users.get(card.userId)?.name} size={72} />
          </div>
          <h2 className="wrap-persona">{name(card.userId)}</h2>
          <p className="wrap-line">{t('wrap.soulmate.line', { n: card.times })}</p>
        </>
      );
    case 'trophies': {
      const nothing = card.month !== null && !card.month.length && !card.weeks;
      return (
        <>
          <p className="wrap-kicker">{t('wrap.trophies.title')}</p>
          <Big>🏆</Big>
          {card.month === null ? (
            <p className="wrap-sub">{t('wrap.trophies.pending')}</p>
          ) : (
            card.month.length > 0 && (
              <>
                <p className="wrap-sub">{t('wrap.trophies.month')}</p>
                <div className="wrap-chips">
                  {card.month.map((c) => (
                    <span key={c} className="wrap-chip">
                      {t(CATEGORY_LABELS[c])}
                    </span>
                  ))}
                </div>
              </>
            )
          )}
          {card.weeks > 0 && <p className="wrap-line">{t('wrap.trophies.weeks', { n: card.weeks })}</p>}
          {card.points > 0 && <p className="wrap-line strong">{t('wrap.trophies.points', { n: card.points })}</p>}
          {nothing && <p className="wrap-line">{t('wrap.trophies.none')}</p>}
        </>
      );
    }
    case 'summary':
      return (
        <>
          <p className="wrap-kicker">{t('wrap.kicker')}</p>
          <h1 className="wrap-title">{t('wrap.summary.title', { month })}</h1>
          <div className="wrap-summary">
            <div>
              <strong>{card.count}</strong>
              <span>{t('wrap.summary.poops')}</span>
            </div>
            <div>
              <strong>{card.of > 1 ? `#${card.rank}` : '–'}</strong>
              <span>{t('wrap.summary.rank')}</span>
            </div>
            <div>
              <strong>{fmtPts(card.points)}</strong>
              <span>{t('wrap.summary.points')}</span>
            </div>
            <div>
              <strong>{fmtNum(card.best)}</strong>
              <span>{t('wrap.summary.best')}</span>
            </div>
            {card.sitTime > 0 && (
              <div>
                <strong>{fmtMinutes(card.sitTime)}</strong>
                <span>{t('wrap.summary.sit')}</span>
              </div>
            )}
            <div className="wide">
              <strong>{t(`wrap.persona.type.${card.type}` as Key)}</strong>
              <span>{t(`wrap.persona.time.${card.persona}` as Key)}</span>
            </div>
          </div>
          <button type="button" className="wrap-replay" onClick={onReplay}>
            ↺ {t('wrap.summary.replay')}
          </button>
        </>
      );
  }
}

/** Background of each card: the intro and the summary share the brand one, the others take turns. */
const tone = (card: WrapCard, i: number) => (card.id === 'intro' || card.id === 'summary' ? 'g0' : `g${1 + ((i - 1) % 5)}`);

function Story({ wrap, months, onClose }: { wrap: WrapData; months: Date[]; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const cards = wrap.cards;
  const card = cards[Math.min(i, cards.length - 1)];
  const go = (d: number) => setI((n) => Math.min(cards.length - 1, Math.max(0, n + d)));
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  return (
    <div
      className={`wrap-stage ${tone(card, i)}`}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = down.current;
        down.current = null;
        if (!s || (e.target as HTMLElement).closest('a, button')) return;
        const dx = e.clientX - s.x;
        const box = e.currentTarget.getBoundingClientRect();
        // A swipe goes its way; a tap on the left third goes back, anywhere else forward.
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        else if (Math.abs(e.clientY - s.y) < 12) go(e.clientX - box.left < box.width / 3 ? -1 : 1);
      }}
    >
      <div className="wrap-progress" aria-label={`${i + 1} / ${cards.length}`}>
        {cards.map((c, n) => (
          <span key={c.id} className={n < i ? 'done' : n === i ? 'on' : ''} />
        ))}
      </div>
      <button type="button" className="wrap-close" onClick={onClose} aria-label={t('common.close')}>
        ✕
      </button>
      <div key={`${monthKey(wrap.month)}-${i}`} className="wrap-card" aria-live="polite">
        <CardBody card={card} wrap={wrap} months={months} onReplay={() => setI(0)} />
      </div>
    </div>
  );
}

/** The month, Spotify-Wrapped style: one stat per card, tap or swipe through, each set against the others. */
export default function Wrap() {
  const t = useT();
  const { month: param } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { me } = useSession();
  const { poops, error } = usePoops();
  const reports = useReports();

  const months = useMemo(() => (poops && me ? wrapMonths(poops, me.id) : []), [poops, me]);
  // Only finished months: anything later (or junk) falls back to last month.
  const asked = parseMonthKey(param);
  const month = asked && asked <= lastMonth() ? asked : lastMonth();
  const at = month.getTime();
  const wrap = useMemo(() => (poops && me ? computeWrap(poops, me.id, new Date(at), reports ?? []) : null), [poops, me, at, reports]);

  // Full screen: the page behind does not scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const close = () => (location.key === 'default' ? navigate('/top') : navigate(-1));

  if (param && asked?.getTime() !== at) return <Navigate to="/wrap" replace />;

  return (
    <div className="wrap" role="dialog" aria-modal="true" aria-label={t('wrap.open')}>
      {wrap ? (
        <Story key={monthKey(month)} wrap={wrap} months={months} onClose={close} />
      ) : (
        <div className="wrap-stage g0">
          <button type="button" className="wrap-close" onClick={close} aria-label={t('common.close')}>
            ✕
          </button>
          <div className="wrap-card">{error ? <p className="wrap-line">{error}</p> : <Spinner label={t('common.loading')} size="lg" />}</div>
        </div>
      )}
    </div>
  );
}
