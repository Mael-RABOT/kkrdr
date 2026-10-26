import { useState } from 'react';
import { getPoop } from '../data';
import { useDialogs } from '../dialogs';
import { useFeed } from '../feed';
import { relative } from '../format';
import { useT } from '../i18n';
import { useNotifications } from '../notifications';
import { useSession } from '../session';
import type { Poop } from '../types';
import Avatar from './Avatar';
import { MentionText } from './Comments';
import Modal from './Modal';
import PoopDetail from './PoopDetail';

/** Bell in the header: how many comments tagged you since you last looked, and the list of them. */
export default function NotificationBell() {
  const t = useT();
  const dialogs = useDialogs();
  const { users } = useSession();
  const { items, error, isNew, unread, markSeen } = useNotifications();
  const { poops: feed } = useFeed();
  // While the list is open: the ones that were new when it opened, which stay marked.
  const [fresh, setFresh] = useState<Set<string> | null>(null);
  const [entry, setEntry] = useState<Poop | null>(null);
  // Prefer the feed's live copy, so votes update in place.
  const shown = entry && (feed?.find((p) => p.id === entry.id) ?? entry);
  const label = unread > 0 ? t('notif.unread', { n: unread }) : t('notif.title');

  function open() {
    setFresh(new Set(items?.filter(isNew).map((m) => `${m.poopId}/${m.comment.id}`)));
    markSeen();
  }

  const close = () => setFresh(null);

  async function show(poopId: string) {
    const p = feed?.find((x) => x.id === poopId) ?? (await getPoop(poopId).catch(() => null));
    if (!p) return dialogs.alert(t('log.notFound'));
    close();
    setEntry(p);
  }

  return (
    <>
      <button type="button" className="icon-switch notif-btn" onClick={open} aria-label={label} title={label}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 && <span className="notif-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {fresh && (
        <Modal onClose={close} className="notif-modal">
          <h2>{t('notif.title')}</h2>
          {error && <p className="error">{t('notif.error', { msg: error })}</p>}
          {items === null && !error && <p className="muted">{t('common.loading')}</p>}
          {items?.length === 0 && <p className="muted">{t('notif.empty')}</p>}
          {!!items?.length && (
            <ul className="notif-list">
              {items.map(({ poopId, comment: c }) => {
                const name = users.get(c.userId)?.name;
                return (
                  <li key={`${poopId}/${c.id}`}>
                    <button type="button" className={fresh.has(`${poopId}/${c.id}`) ? 'new' : undefined} onClick={() => show(poopId)}>
                      <Avatar id={c.userId} name={name} size={32} />
                      <span className="notif-body">
                        <span className="notif-head">
                          <strong>{t('notif.mentioned', { name: name ?? t('common.unknown') })}</strong>
                          <span className="muted">{relative(c.createdAt)}</span>
                        </span>
                        <span className="notif-text">
                          <MentionText text={c.text} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="modal-actions">
            <button type="button" className="primary" onClick={close}>
              {t('common.close')}
            </button>
          </div>
        </Modal>
      )}
      {shown && <PoopDetail poop={shown} onClose={() => setEntry(null)} />}
    </>
  );
}
