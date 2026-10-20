let lang = 'en';

/** Set by the i18n provider so dates follow the chosen language. */
export function setFormatLang(l: string) {
  lang = l;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday 00:00 of the week containing d. */
export function weekStart(d: Date): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayLabel(d: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (diff === 0 || diff === 1) return cap(new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-diff, 'day'));
  return cap(d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }));
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
}

export function monthLabel(d: Date): string {
  return cap(d.toLocaleDateString(lang, { month: 'long', year: 'numeric' }));
}

export function timeOfDay(d: Date): string {
  return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

export function relative(d: Date, now = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return rtf.format(0, 'second');
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, 'minute');
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, 'hour');
  return timeOfDay(d);
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  return n == null ? '–' : n.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(d: Date): string {
  return `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Points: no decimals when whole, one otherwise (scores move in steps of 0.5). */
export function fmtPts(n: number | null | undefined): string {
  return n == null ? '–' : fmtNum(n, Number.isInteger(n) ? 0 : 1);
}
