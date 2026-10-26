import { Link } from 'react-router-dom';
import { dayLabel, timeOfDay } from '../format';
import { useT, type Key, type T } from '../i18n';
import { useSession } from '../session';
import { useProfilePath } from '../users';
import type { Poop } from '../types';
import Avatar from './Avatar';
import { ColorDot } from './ColorPicker';
import Comments from './Comments';
import Modal from './Modal';
import PostMedia from './PostMedia';
import PostSound from './SoundPlayer';
import ScorePill from './ScorePill';
import TypeIcon from './TypeIcon';
import VoteButtons from './VoteButtons';

/** "Home · bathroom 2", or just the note for "other". */
export function placeText(p: Poop, t: T): string {
  const label = t(`place.${p.place}` as Key);
  if (p.place === 'other' && p.placeNote) return p.placeNote;
  return label + (p.placeNote ? ` · ${p.placeNote}` : '');
}

/** One entry in a popup: every field, who voted which way, and the comments. */
export default function PoopDetail({ poop: p, onClose, focusComments }: { poop: Poop; onClose: () => void; focusComments?: boolean }) {
  const t = useT();
  const { me, users } = useSession();
  const profilePath = useProfilePath();
  const name = users.get(p.userId)?.name;
  const votes = Object.entries(p.votes ?? {});
  const likes = votes.filter(([, v]) => v === 1).map(([id]) => id);
  const dislikes = votes.filter(([, v]) => v === -1).map(([id]) => id);

  function voters(ids: string[]) {
    return (
      <ul className="voters">
        {ids.map((id) => (
          <li key={id}>
            <Link to={profilePath(id)} onClick={onClose}>
              <Avatar id={id} name={users.get(id)?.name} size={24} />
              <span>
                {users.get(id)?.name ?? t('common.unknown')}
                {id === me?.id && <small className="muted"> ({t('common.you')})</small>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Modal onClose={onClose} className={`poop-detail${p.perfect ? ' perfect' : ''}`}>
      <div className="detail-head">
        <Link to={profilePath(p.userId)} onClick={onClose} className="detail-who">
          <Avatar id={p.userId} name={name} size={44} />
          <span>
            <strong>{name ?? t('common.unknown')}</strong>
            <small className="muted">
              {dayLabel(p.at)} · {timeOfDay(p.at)}
            </small>
            {p.pending && <span className="pill pending">{t('common.pending')}</span>}
          </span>
        </Link>
        <ScorePill poop={p} big />
      </div>

      <PostMedia poop={p} />
      <PostSound poop={p} />

      <dl className="detail-fields">
        <div>
          <dt>{t('log.type')}</dt>
          <dd>
            {p.perfect ? (
              <span className="pill perfect">{t('feed.perfect')}</span>
            ) : (
              <>
                <TypeIcon type={p.type} size={32} />
                {t(`type.${p.type}` as Key)}
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('log.size')}</dt>
          <dd>{t(`size.${p.size}` as Key)}</dd>
        </div>
        {p.color && (
          <div>
            <dt>{t('log.color')}</dt>
            <dd>
              <ColorDot color={p.color} />
              {t(`color.${p.color}` as Key)}
            </dd>
          </div>
        )}
        <div>
          <dt>{t('log.where')}</dt>
          <dd>{placeText(p, t)}</dd>
        </div>
        {p.duration != null && (
          <div>
            <dt>{t('log.duration')}</dt>
            <dd>{t('feed.min', { n: p.duration })}</dd>
          </div>
        )}
        {p.rating != null && (
          <div>
            <dt>{t('log.rating')}</dt>
            <dd>{p.rating}/5</dd>
          </div>
        )}
        {p.note && (
          <div className="wide">
            <dt>{t('log.note')}</dt>
            <dd className="note">{p.note}</dd>
          </div>
        )}
      </dl>

      <div className="detail-votes">
        <VoteButtons poop={p} />
        {votes.length === 0 ? (
          <p className="muted">{t('detail.noVotes')}</p>
        ) : (
          <div className="voter-cols">
            <section>
              <h3 className="up">
                {t('detail.likes')} · {likes.length}
              </h3>
              {voters(likes)}
            </section>
            <section>
              <h3 className="down">
                {t('detail.dislikes')} · {dislikes.length}
              </h3>
              {voters(dislikes)}
            </section>
          </div>
        )}
      </div>

      <Comments poop={p} autoFocus={focusComments} onNavigate={onClose} />

      <div className="modal-actions">
        {p.userId === me?.id && (
          <Link to={`/edit/${p.id}`} className="link-btn detail-edit" onClick={onClose}>
            {t('common.edit')}
          </Link>
        )}
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}
