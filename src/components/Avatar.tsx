const COLORS = ['#c0703f', '#d39b2a', '#8a6f4e', '#5f8a6b', '#b5574b', '#7a6aa3'];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Avatar({ id, name, size = 40 }: { id: string; name: string | undefined; size?: number }) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span
      className="avatar"
      style={{ background: COLORS[hash(id) % COLORS.length], width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
