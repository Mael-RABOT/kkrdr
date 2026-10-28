import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router-dom';
import { canRecord, COMMENT_SECS, MAX_COMMENT_SOUND_BYTES } from '../audio';
import { addComment, deleteComment, editComment, getCommentSound, likeComment, subscribeComments, type Sound } from '../data';
import { useDialogs } from '../dialogs';
import { dayLabel, timeOfDay } from '../format';
import { useT } from '../i18n';
import { mentionedIds, mentionQuery, splitMentions, suggest } from '../mentions';
import { useSession } from '../session';
import type { Comment, Poop, User } from '../types';
import { useRecorder } from '../useRecorder';
import { useProfilePath } from '../users';
import Avatar from './Avatar';
import { MicIcon, RecordingBar } from './SoundField';
import { SoundPlayer } from './SoundPlayer';

const MAX = 280;

/**
 * An entry's comments in its popup: the list, and a box to add one, with text, a voice message, or
 * both (the text can still tag people). Authors may edit or delete theirs.
 */
export default function Comments({ poop, autoFocus, onNavigate }: { poop: Poop; autoFocus?: boolean; onNavigate: () => void }) {
  const t = useT();
  const dialogs = useDialogs();
  const { me, users } = useSession();
  const profilePath = useProfilePath();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [voice, setVoice] = useState<{ sound: Sound; preview: string } | null>(null);
  const section = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const recorder = useRecorder({
    maxSecs: COMMENT_SECS,
    maxBytes: MAX_COMMENT_SOUND_BYTES,
    onDone: (sound) => setVoice({ sound, preview: URL.createObjectURL(new Blob([sound.bytes], { type: sound.type })) }),
  });
  const preview = voice?.preview;

  // Free the preview once sent or thrown away.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  useEffect(() => subscribeComments(poop.id, setComments, (e) => dialogs.alert(e.message)), [poop.id, dialogs]);

  // Opened from the feed's comment button: go straight to the box, once the popup is open.
  useEffect(() => {
    if (!autoFocus) return;
    const id = requestAnimationFrame(() => {
      input.current?.focus();
      section.current?.scrollIntoView({ block: 'end' });
    });
    return () => cancelAnimationFrame(id);
  }, [autoFocus]);

  const fail = (e: unknown) => dialogs.alert(e instanceof Error ? e.message : String(e));

  function send() {
    const v = text.trim();
    if (!me || (!v && !voice) || recorder.recording) return;
    // Queued offline like other writes: clear the box at once.
    addComment(poop.id, me.id, v, mentionedIds(v, users.values(), me.id), voice?.sound).catch(fail);
    setText('');
    setVoice(null);
  }

  function save() {
    if (!editing || !me) return;
    const v = editing.text.trim();
    const before = comments?.find((c) => c.id === editing.id);
    // Only a voice message may be left without text.
    if (!v && !before?.sound) return;
    if (v !== before?.text) editComment(poop.id, editing.id, v, mentionedIds(v, users.values(), me.id)).catch(fail);
    setEditing(null);
  }

  async function remove(c: Comment) {
    const ok = await dialogs.confirm({ title: t('comments.deleteTitle'), message: t('comments.confirmDelete'), confirmLabel: t('common.delete'), danger: true });
    if (ok) deleteComment(poop.id, c).catch(fail);
  }

  /** Tags the author in the box, unless they already are. */
  function reply(c: Comment) {
    const name = users.get(c.userId)?.name;
    if (!name) return;
    const tag = `@${name} `;
    const next = text.includes(tag) ? text : text && !/\s$/.test(text) ? `${text} ${tag}` : text + tag;
    setText(next.slice(0, MAX));
    const el = input.current;
    if (!el) return;
    el.focus();
    // After React has put the new text in.
    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
    section.current?.scrollIntoView({ block: 'end' });
  }

  const count = comments?.length ?? poop.commentCount ?? 0;
  return (
    <section ref={section} className="detail-comments">
      <h3>
        {t('comments.title')} · {count}
      </h3>
      {comments?.length === 0 && <p className="muted">{t('comments.none')}</p>}
      {!!comments?.length && (
        <ul className="comments">
          {comments.map((c) => {
            const name = users.get(c.userId)?.name;
            const mine = c.userId === me?.id;
            return (
              <li key={c.id} className="comment">
                <Link to={profilePath(c.userId)} onClick={onNavigate}>
                  <Avatar id={c.userId} name={name} size={28} />
                </Link>
                <div className="comment-body">
                  <div className="comment-head">
                    <Link to={profilePath(c.userId)} onClick={onNavigate}>
                      {name ?? t('common.unknown')}
                    </Link>
                    <span className="muted">
                      {dayLabel(c.createdAt)} · {timeOfDay(c.createdAt)}
                      {c.editedAt && ` · ${t('comments.edited')}`}
                    </span>
                    {c.pending && <span className="pill pending">{t('common.pending')}</span>}
                  </div>
                  {editing?.id === c.id ? (
                    <CommentBox
                      value={editing.text}
                      onChange={(v) => setEditing({ id: c.id, text: v })}
                      onSubmit={save}
                      autoFocus
                      actions={
                        <>
                          <button type="button" className="sm" onClick={() => setEditing(null)}>
                            {t('common.cancel')}
                          </button>
                          <button type="submit" className="sm primary" disabled={!editing.text.trim() && !c.sound}>
                            {t('log.save')}
                          </button>
                        </>
                      }
                    />
                  ) : (
                    <>
                      {c.sound && <SoundPlayer key={c.sound.v} secs={c.sound.secs} load={() => getCommentSound(poop.id, c.id, c.sound!.v)} />}
                      {c.text && (
                        <p className="comment-text">
                          <MentionText text={c.text} onNavigate={onNavigate} />
                        </p>
                      )}
                      <span className="comment-actions">
                        <LikeButton comment={c} mine={mine} onToggle={(on) => me && likeComment(poop.id, c.id, me.id, on).catch(fail)} />
                        {!mine && name && (
                          <button type="button" className="link" onClick={() => reply(c)}>
                            {t('comments.reply')}
                          </button>
                        )}
                        {mine && (
                          <>
                            <button type="button" className="link" onClick={() => setEditing({ id: c.id, text: c.text })}>
                              {t('common.edit')}
                            </button>
                            <button type="button" className="link danger" onClick={() => remove(c)}>
                              {t('common.delete')}
                            </button>
                          </>
                        )}
                      </span>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <CommentBox
        ref={input}
        value={text}
        onChange={setText}
        onSubmit={send}
        placeholder={voice ? t('comments.voicePlaceholder') : t('comments.placeholder')}
        top={
          recorder.recording ? (
            <RecordingBar recording={recorder.recording} elapsed={recorder.elapsed} maxSecs={COMMENT_SECS} />
          ) : (
            voice && (
              <div className="sound-chosen">
                <SoundPlayer key={voice.preview} secs={voice.sound.secs} load={async () => voice.preview} />
                <button type="button" className="link danger" onClick={() => setVoice(null)}>
                  {t('sound.remove')}
                </button>
              </div>
            )
          )
        }
        actions={
          <>
            {canRecord && !voice && !recorder.recording && (
              <button
                type="button"
                className="comment-mic"
                onClick={recorder.start}
                disabled={recorder.starting}
                aria-label={t('comments.record', { n: COMMENT_SECS })}
                title={t('comments.record', { n: COMMENT_SECS })}
              >
                <MicIcon size={20} />
              </button>
            )}
            <button type="submit" className="primary comment-send" disabled={(!text.trim() && !voice) || !!recorder.recording}>
              {t('comments.send')}
            </button>
          </>
        }
      />
      {recorder.error && <p className="error">{recorder.error}</p>}
    </section>
  );
}

/** A heart and how many liked the comment. Your own comment just shows the count, if any. */
function LikeButton({ comment, mine, onToggle }: { comment: Comment; mine: boolean; onToggle: (on: boolean) => void }) {
  const t = useT();
  const { me } = useSession();
  const n = comment.likes?.length ?? 0;
  const liked = !!me && !!comment.likes?.includes(me.id);
  if (mine && !n) return null;
  return (
    <button
      type="button"
      className={`comment-like${liked ? ' on' : ''}`}
      onClick={() => onToggle(!liked)}
      disabled={mine}
      aria-pressed={liked}
      aria-label={t(liked ? 'comments.unlike' : 'comments.like')}
      title={t(liked ? 'comments.unlike' : 'comments.like')}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <path
          d="M8 13.5S2 10 2 6a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 7.5-6 7.5z"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      {!!n && <span>{n}</span>}
    </button>
  );
}

/**
 * A comment's text with its @mentions highlighted (yours more). With `onNavigate` they link to the
 * profiles; without, they are plain text (inside something already clickable).
 */
export function MentionText({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const { me, users } = useSession();
  const profilePath = useProfilePath();
  return splitMentions(text, users.values()).map((part, i) => {
    if (typeof part === 'string') return part;
    const className = `mention${part.user.id === me?.id ? ' me' : ''}`;
    return onNavigate ? (
      <Link key={i} to={profilePath(part.user.id)} onClick={onNavigate} className={className}>
        @{part.user.name}
      </Link>
    ) : (
      <span key={i} className={className}>
        @{part.user.name}
      </span>
    );
  });
}

/** A comment text box with its buttons below; typing @ suggests people to tag. */
function CommentBox({
  value,
  onChange,
  onSubmit,
  actions,
  top,
  placeholder,
  autoFocus,
  ref,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  actions: ReactNode;
  /** Above the box: a voice message being recorded or ready to send. */
  top?: ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}) {
  const { users } = useSession();
  const box = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);

  const typing = caret === null ? null : mentionQuery(value, caret);
  const matches = typing && typing.start !== dismissed ? suggest(users.values(), typing.query) : [];
  // Nothing left to suggest once the name is typed out in full.
  const open = matches.length > 0 && !(matches.length === 1 && matches[0].name === typing?.query);

  function setRefs(el: HTMLTextAreaElement | null) {
    box.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }

  function pick(u: User) {
    if (!typing || caret === null) return;
    const tag = `@${u.name} `;
    const next = (value.slice(0, typing.start) + tag + value.slice(caret)).slice(0, MAX);
    const at = Math.min(typing.start + tag.length, next.length);
    onChange(next);
    setCaret(at);
    const el = box.current;
    if (!el) return;
    el.focus();
    requestAnimationFrame(() => el.setSelectionRange(at, at));
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(matches[Math.min(active, matches.length - 1)]);
    } else if (e.key === 'Escape') {
      // Close the list, not the popup.
      e.preventDefault();
      e.stopPropagation();
      setDismissed(typing!.start);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form className="comment-form" onSubmit={submit}>
      {top}
      <textarea
        ref={setRefs}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setActive(0);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={() => setCaret(null)}
        placeholder={placeholder}
        maxLength={MAX}
        rows={2}
        autoFocus={autoFocus}
      />
      {open && (
        <ul className="mention-list" role="listbox">
          {matches.map((u, i) => (
            <li key={u.id} role="option" aria-selected={i === active}>
              {/* mousedown, so the box doesn't lose focus (and the list) first */}
              <button type="button" className={i === active ? 'on' : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(u)}>
                <Avatar id={u.id} name={u.name} size={22} />
                <span>{u.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="comment-form-actions">{actions}</div>
    </form>
  );
}
