import { useState, type FormEvent, type ReactNode } from 'react';
import type { NewPoop } from '../data';
import { useDialogs } from '../dialogs';
import { fmtNum, toLocalInput } from '../format';
import { baseScore } from '../game';
import { useT, type Key } from '../i18n';
import { PLACE_IDS, SIZE_IDS, type Place, type Poop, type Size } from '../types';
import Segmented from './Segmented';
import TypePicker from './TypePicker';

const ratingOptions = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));

interface Props {
  /** Entry being edited; a new one starts from now, smooth, medium, at home. */
  initial?: Poop;
  submitLabel: string;
  onSave: (p: NewPoop) => void;
  /** Extra content under the save button (e.g. delete on the edit page). */
  footer?: ReactNode;
}

/** The log form, shared by the new and edit pages. */
export default function PoopForm({ initial, submitLabel, onSave, footer }: Props) {
  const t = useT();
  const dialogs = useDialogs();
  const sizeOptions = SIZE_IDS.map((v) => ({ value: v, label: t(`size.${v}` as Key) }));
  const placeOptions = PLACE_IDS.map((v) => ({ value: v, label: t(`place.${v}` as Key) }));
  const [at, setAt] = useState(() => toLocalInput(initial?.at ?? new Date()));
  const [type, setType] = useState<number | undefined>(initial?.type ?? 4);
  const [size, setSize] = useState<Size | undefined>(initial?.size ?? 'M');
  const [place, setPlace] = useState<Place | undefined>(initial?.place ?? 'home');
  const [placeNote, setPlaceNote] = useState(initial?.placeNote ?? '');
  const [duration, setDuration] = useState(initial?.duration != null ? String(initial.duration) : '');
  const [rating, setRating] = useState<number | undefined>(initial?.rating);
  const [perfect, setPerfect] = useState(initial?.perfect ?? false);
  const [note, setNote] = useState(initial?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!type && !!size && !!place && (perfect || !!rating) && !!note.trim();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return setError(t('log.invalidTime'));
    if (date.getTime() > Date.now() + 60_000) return setError(t('log.futureTime'));
    setBusy(true);
    onSave({
      at: date,
      // A Perfect always counts as smooth, rated 5/5.
      type: perfect ? 4 : type,
      size,
      place,
      placeNote: placeNote.trim() || undefined,
      duration: duration ? Math.min(180, Math.max(0, Math.round(Number(duration)))) : undefined,
      rating: perfect ? 5 : rating,
      perfect: perfect || undefined,
      note: note.trim(),
    });
  }

  async function togglePerfect() {
    if (perfect) {
      setPerfect(false);
      // Back to the picker: keep what Perfect implied.
      setType(4);
      setRating(5);
      return;
    }
    const ok = await dialogs.confirm({
      title: t('log.perfect'),
      message: t('log.perfectConfirm'),
      confirmLabel: t('log.perfectYes'),
      gold: true,
    });
    if (ok) setPerfect(true);
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form-col">
        <section className="card form-what">
          <h2>{t('log.what')}</h2>
          {perfect ? (
            <div className="perfect-banner">
              <strong>{t('log.perfect')}</strong>
              <span>{t('log.perfectOn')}</span>
              <button type="button" className="link" onClick={togglePerfect}>
                {t('log.perfectUndo')}
              </button>
            </div>
          ) : (
            <button type="button" className="perfect-btn" onClick={togglePerfect}>
              <strong>{t('log.perfect')}</strong>
              <small>{t('log.perfectHint')}</small>
            </button>
          )}
          {!perfect && (
            <div>
              <span className="label">{t('log.type')}</span>
              <TypePicker value={type} onChange={setType} />
            </div>
          )}
          <div>
            <span className="label">{t('log.size')}</span>
            <Segmented options={sizeOptions} value={size} onChange={setSize} />
          </div>
          {!perfect && (
            <div>
              <span className="label">{t('log.rating')}</span>
              <Segmented options={ratingOptions} value={rating} onChange={setRating} />
            </div>
          )}
        </section>
      </div>

      <div className="form-col">
        <section className="card form-when">
          <h2>{t('log.when')}</h2>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required aria-label={t('log.when')} />
        </section>

        <section className="card form-where">
          <h2>{t('log.where')}</h2>
          <div>
            <Segmented options={placeOptions} value={place} onChange={setPlace} columns={3} />
            <input
              className="mt"
              value={placeNote}
              onChange={(e) => setPlaceNote(e.target.value)}
              maxLength={60}
              placeholder={t('log.whereExactly')}
            />
          </div>
        </section>

        <section className="card form-extras">
          <h2>{t('log.extras')}</h2>
          <label>
            <span className="label">{t('log.duration')}</span>
            <input type="number" inputMode="numeric" min={0} max={180} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label>
            <span className="label">{t('log.note')}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} required />
          </label>
        </section>
      </div>

      {error && <p className="error form-error">{error}</p>}
      <div className="save-bar">
        <button className="primary big save-btn" disabled={busy || !ready}>
          <span>{busy ? t('log.saving') : submitLabel}</span>
          {type && (
            <span className="save-score">
              {t('log.scorePreview', { score: fmtNum(baseScore(perfect ? { type: 4, rating: 5 } : { type, rating })) })}
            </span>
          )}
        </button>
      </div>
      {footer && <div className="form-footer">{footer}</div>}
    </form>
  );
}
