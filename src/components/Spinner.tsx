/** Loading indicator; the label is read by screen readers and optionally shown next to it. */
export default function Spinner({ label, size = 'md', show = false }: { label: string; size?: 'sm' | 'md' | 'lg'; show?: boolean }) {
  return (
    <span className={`spinner-wrap ${size}`} role="status">
      <svg className="spinner" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9.5" fill="none" strokeWidth="3" />
        <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" fill="none" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className={show ? 'spinner-label' : 'sr-only'}>{label}</span>
    </span>
  );
}

/** Centered block spinner for a page whose data is loading. */
export function PageSpinner({ label }: { label: string }) {
  return (
    <div className="page-spinner muted">
      <Spinner label={label} show />
    </div>
  );
}
