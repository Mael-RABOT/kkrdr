import { useT, type Key } from '../i18n';
import { COLOR_IDS, type Color } from '../types';

/** Round color swatches; tapping the selected one clears it. */
export default function ColorPicker({ value, onChange }: { value: Color | undefined; onChange: (c: Color | undefined) => void }) {
  const t = useT();
  return (
    <div className="color-picker" role="radiogroup" aria-label={t('log.color')}>
      {COLOR_IDS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={t(`color.${c}` as Key)}
          title={t(`color.${c}` as Key)}
          className={`swatch swatch-${c}${c === value ? ' on' : ''}`}
          onClick={() => onChange(c === value ? undefined : c)}
        />
      ))}
      {value && <span className="color-name">{t(`color.${value}` as Key)}</span>}
    </div>
  );
}

/** A small inline dot of the given color. */
export function ColorDot({ color }: { color: Color }) {
  return <span className={`swatch swatch-${color} dot`} aria-hidden />;
}
