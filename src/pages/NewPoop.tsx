import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHead from '../components/PageHead';
import Segmented from '../components/Segmented';
import TypePicker from '../components/TypePicker';
import { addPoop } from '../data';
import { fmtNum, toLocalInput } from '../format';
import { baseScore } from '../game';
import { useT, type Key } from '../i18n';
import { useSession } from '../session';
import { PLACE_IDS, SIZE_IDS, type Place, type Size } from '../types';

const ratingOptions = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));

export default function NewPoop() {
  const t = useT();
  const sizeOptions = SIZE_IDS.map((v) => ({ value: v, label: t(`size.${v}` as Key) }));
  const placeOptions = PLACE_IDS.map((v) => ({ value: v, label: t(`place.${v}` as Key) }));
  const { me } = useSession();
  const navigate = useNavigate();
  const [at, setAt] = useState(() => toLocalInput(new Date()));
  const [type, setType] = useState<number | undefined>(4);
  const [size, setSize] = useState<Size | undefined>('M');
  const [place, setPlace] = useState<Place | undefined>('home');
  const [placeNote, setPlaceNote] = useState('');
  const [duration, setDuration] = useState('');
  const [rating, setRating] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!me || !type || !size || !place) return;
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return setError(t('log.invalidTime'));
    if (date.getTime() > Date.now() + 60_000) return setError(t('log.futureTime'));
    setBusy(true);
    // Not awaited: the local cache shows the entry right away and syncs it when online.
    addPoop(me.id, {
      at: date,
      type,
      size,
      place,
      placeNote: placeNote.trim() || undefined,
      duration: duration ? Math.min(180, Math.max(0, Math.round(Number(duration)))) : undefined,
      rating,
      note: note.trim() || undefined,
    }).catch((err) => alert(t('log.saveFailed', { msg: err instanceof Error ? err.message : String(err) })));
    navigate('/');
  }

  return (
    <>
      <PageHead title={t('log.title')} />
      <form className="form" onSubmit={onSubmit}>
        <section className="card">
          <h2>{t('log.when')}</h2>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required aria-label={t('log.when')} />
        </section>

        <section className="card">
          <h2>{t('log.what')}</h2>
          <div>
            <span className="label">{t('log.type')}</span>
            <TypePicker value={type} onChange={setType} />
          </div>
          <div>
            <span className="label">{t('log.size')}</span>
            <Segmented options={sizeOptions} value={size} onChange={setSize} />
          </div>
          <div>
            <span className="label">{t('log.rating')}</span>
            <Segmented options={ratingOptions} value={rating} onChange={setRating} allowClear />
          </div>
        </section>

        <section className="card">
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

        <section className="card">
          <h2>{t('log.extras')}</h2>
          <label>
            <span className="label">{t('log.duration')}</span>
            <input type="number" inputMode="numeric" min={0} max={180} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label>
            <span className="label">{t('log.note')}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} />
          </label>
        </section>

        {error && <p className="error">{error}</p>}
        <div className="save-bar">
          <button className="primary big save-btn" disabled={busy || !type || !size || !place}>
            <span>{busy ? t('log.saving') : t('log.save')}</span>
            {type && <span className="save-score">{t('log.scorePreview', { score: fmtNum(baseScore({ type, rating })) })}</span>}
          </button>
        </div>
      </form>
    </>
  );
}
