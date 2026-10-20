import { fmtNum } from '../format';
import { textureFactor } from '../game';
import { useT, type Key } from '../i18n';
import { TYPE_IDS } from '../types';
import TypeIcon from './TypeIcon';

/** The 7 Bristol types as a selectable list: picture, name, description and score multiplier. */
export default function TypePicker({ value, onChange }: { value: number | undefined; onChange: (type: number) => void }) {
  const t = useT();
  return (
    <div className="type-picker" role="radiogroup" aria-label={t('log.type')}>
      {TYPE_IDS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          className={`type-row${n === value ? ' on' : ''}`}
          onClick={() => onChange(n)}
        >
          <span className="type-pic">
            <TypeIcon type={n} size={48} />
          </span>
          <span className="type-text">
            <strong>{t(`type.${n}` as Key)}</strong>
            <small>{t(`type.${n}.desc` as Key)}</small>
          </span>
          <span className="type-factor">x{fmtNum(textureFactor(n), 2)}</span>
        </button>
      ))}
      <p className="hint">{t('log.scaleIntro')}</p>
    </div>
  );
}
