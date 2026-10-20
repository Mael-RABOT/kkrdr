interface Props {
  data: { label: string; value: number }[];
  height?: number;
}

/** Minimal vertical bar chart, plain CSS. */
export default function BarChart({ data, height = 80 }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="bar" title={`${d.label}: ${d.value}`}>
          <div className="bar-fill" style={{ height: `${(d.value / max) * 100}%` }} />
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
