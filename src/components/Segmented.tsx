interface Props<T extends string | number> {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  allowClear?: boolean;
  columns?: number;
  variant?: 'pills';
}

export default function Segmented<T extends string | number>({ options, value, onChange, allowClear, columns, variant }: Props<T>) {
  return (
    <div
      className={`segmented${variant ? ` ${variant}` : ''}`}
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, 1fr)` }}
    >
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={o.value === value ? 'on' : ''}
          aria-pressed={o.value === value}
          onClick={() => onChange(allowClear && o.value === value ? undefined : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
