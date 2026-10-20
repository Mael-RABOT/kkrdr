import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import PageHead from '../components/PageHead';
import { deletePoop, subscribeFeed } from '../data';
import { dayKey, dayLabel, relative } from '../format';
import { useSession } from '../session';
import { PLACES, SIZES, TYPES, type Poop } from '../types';

export default function Feed() {
  const { me, users } = useSession();
  const [poops, setPoops] = useState<Poop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => subscribeFeed(50, setPoops, (e) => setError(e.message)), []);

  // Refresh relative times every minute.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  async function remove(p: Poop) {
    if (!confirm('Delete this entry?')) return;
    try {
      await deletePoop(p.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  let lastDay = '';
  return (
    <>
      <PageHead title="Feed" />
      {error && <p className="error">{error}</p>}
      {!poops && !error && <p className="muted">Loading</p>}
      {poops?.length === 0 && (
        <div className="card empty">
          <p className="muted">Nothing logged yet.</p>
          <button className="primary" onClick={() => navigate('/new')}>
            Log the first one
          </button>
        </div>
      )}
      <ul className="feed">
        {poops?.map((p) => {
          const k = dayKey(p.at);
          const header =
            k !== lastDay ? (
              <li key={'day-' + k} className="day">
                {dayLabel(p.at)}
              </li>
            ) : null;
          lastDay = k;
          const name = users.get(p.userId)?.name;
          const place =
            p.place === 'other' && p.placeNote ? p.placeNote : PLACES[p.place] + (p.placeNote ? ` · ${p.placeNote}` : '');
          return [
            header,
            <li key={p.id} className="entry">
              <Avatar id={p.userId} name={name} />
              <div className="entry-body">
                <div className="entry-top">
                  <strong>{name ?? 'Unknown'}</strong>
                  <span className="muted">{relative(p.at)}</span>
                </div>
                <div className="tags">
                  <span className="pill">{TYPES[p.type]}</span>
                  <span className="pill">{SIZES[p.size]}</span>
                  <span className="pill">{place}</span>
                  {p.duration != null && <span className="pill">{p.duration} min</span>}
                  {p.rating != null && <span className="pill amber">{p.rating}/5</span>}
                </div>
                {p.note && <p className="note">{p.note}</p>}
                {p.userId === me?.id && (
                  <button className="link danger" onClick={() => remove(p)}>
                    Delete
                  </button>
                )}
              </div>
            </li>,
          ];
        })}
      </ul>
    </>
  );
}
