import { vote } from '../data';
import { netVotes } from '../game';
import { useDialogs } from '../dialogs';
import { useT } from '../i18n';
import { useSession } from '../session';
import type { Poop } from '../types';

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d={up ? 'M3 10l5-5 5 5' : 'M3 6l5 5 5-5'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function VoteButtons({ poop }: { poop: Poop }) {
  const t = useT();
  const dialogs = useDialogs();
  const { me } = useSession();
  const own = poop.userId === me?.id;
  const mine = me ? poop.votes?.[me.id] : undefined;
  const net = netVotes(poop);

  function cast(v: 1 | -1) {
    if (!me || own) return;
    vote(poop.id, me.id, mine === v ? null : v).catch((e) => dialogs.alert(e instanceof Error ? e.message : String(e)));
  }

  return (
    <div className={`votes${own ? ' own' : ''}`}>
      <button className={mine === 1 ? 'up on' : 'up'} onClick={() => cast(1)} disabled={own} aria-label={t('feed.upvote')} aria-pressed={mine === 1}>
        <Chevron up />
      </button>
      <span className={`vote-count${net > 0 ? ' pos' : net < 0 ? ' neg' : ''}`}>{net > 0 ? `+${net}` : net}</span>
      <button className={mine === -1 ? 'down on' : 'down'} onClick={() => cast(-1)} disabled={own} aria-label={t('feed.downvote')} aria-pressed={mine === -1}>
        <Chevron />
      </button>
    </div>
  );
}
