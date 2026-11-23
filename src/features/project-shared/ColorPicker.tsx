import { useId } from 'react';
import { Check } from 'lucide-react';
import { cx } from '../../ui';
import { PROJECT_COLORS } from './colors';
import styles from './ColorPicker.module.css';

export interface ColorPickerProps {
  label: string;
  /** Accessible names for the swatches, e.g. "Colour 3". */
  swatchLabel: (index: number) => string;
  /** Label of the "no colour" option. */
  noneLabel: string;
  value: string | undefined;
  onChange: (color: string | undefined) => void;
}

/** A radio group of colour swatches plus "none". A custom colour from project.json is kept as an extra swatch. */
export function ColorPicker({ label, swatchLabel, noneLabel, value, onChange }: ColorPickerProps) {
  const name = useId();
  const colors = value && !PROJECT_COLORS.includes(value) ? [...PROJECT_COLORS, value] : PROJECT_COLORS;
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.swatches}>
        <label className={styles.option} title={noneLabel}>
          <input
            type="radio"
            name={name}
            className="visually-hidden"
            checked={!value}
            onChange={() => onChange(undefined)}
            aria-label={noneLabel}
          />
          <span className={cx(styles.swatch, styles.none)} aria-hidden="true" />
        </label>
        {colors.map((color, i) => (
          <label key={color} className={styles.option} title={swatchLabel(i + 1)}>
            <input
              type="radio"
              name={name}
              className="visually-hidden"
              checked={value === color}
              onChange={() => onChange(color)}
              aria-label={swatchLabel(i + 1)}
            />
            <span className={styles.swatch} style={{ background: color }} aria-hidden="true">
              {value === color && <Check size={14} />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
