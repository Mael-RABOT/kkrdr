import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHead from '../components/PageHead';
import Segmented from '../components/Segmented';
import { addPoop } from '../data';
import { toLocalInput } from '../format';
import { useSession } from '../session';
import { PLACES, SIZES, TYPES, type Place, type Size } from '../types';

const typeOptions = Object.keys(TYPES).map((v) => ({ value: Number(v), label: v }));
const sizeOptions = (Object.keys(SIZES) as Size[]).map((v) => ({ value: v, label: SIZES[v] }));
const placeOptions = (Object.keys(PLACES) as Place[]).map((v) => ({ value: v, label: PLACES[v] }));
const ratingOptions = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));

export default function NewPoop() {
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!me || !type || !size || !place) return;
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return setError('Invalid time');
    if (date.getTime() > Date.now() + 60_000) return setError('Time is in the future');
    setBusy(true);
    setError(null);
    try {
      await addPoop(me.id, {
        at: date,
        type,
        size,
        place,
        placeNote: placeNote.trim() || undefined,
        duration: duration ? Math.min(180, Math.max(0, Math.round(Number(duration)))) : undefined,
        rating,
        note: note.trim() || undefined,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Log" />
      <form className="form" onSubmit={onSubmit}>
        <section className="card">
          <h2>When</h2>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required aria-label="Time" />
        </section>

        <section className="card">
          <h2>What</h2>
          <div>
            <span className="label">Type</span>
            <Segmented options={typeOptions} value={type} onChange={setType} />
            <p className="type-label">{type ? TYPES[type] : 'Pick a type'}</p>
          </div>
          <div>
            <span className="label">Size</span>
            <Segmented options={sizeOptions} value={size} onChange={setSize} />
          </div>
        </section>

        <section className="card">
          <h2>Where</h2>
          <div>
            <Segmented options={placeOptions} value={place} onChange={setPlace} columns={3} />
            <input
              className="mt"
              value={placeNote}
              onChange={(e) => setPlaceNote(e.target.value)}
              maxLength={60}
              placeholder="Where exactly (optional)"
            />
          </div>
        </section>

        <section className="card">
          <h2>Extras</h2>
          <div>
            <span className="label">Rating</span>
            <Segmented options={ratingOptions} value={rating} onChange={setRating} allowClear />
          </div>
          <label>
            <span className="label">Duration in minutes</span>
            <input type="number" inputMode="numeric" min={0} max={180} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label>
            <span className="label">Note</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} />
          </label>
        </section>

        {error && <p className="error">{error}</p>}
        <div className="save-bar">
          <button className="primary big" disabled={busy || !type || !size || !place}>
            {busy ? 'Saving' : 'Save'}
          </button>
        </div>
      </form>
    </>
  );
}
