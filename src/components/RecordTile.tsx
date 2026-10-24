/** A record: the value, what it is and who holds it. */
export default function RecordTile({ label, value, who, wide, extra }: { label: string; value: string | null; who: string | null; wide?: boolean; extra?: string }) {
  return (
    <div className={`tile${wide ? ' wide' : ''}`}>
      <span className="tile-value">{value ?? '–'}</span>
      <span className="tile-label">{label}</span>
      {who && <span className="tile-sub">{who}</span>}
      {extra && <span className="tile-extra">{extra}</span>}
    </div>
  );
}
