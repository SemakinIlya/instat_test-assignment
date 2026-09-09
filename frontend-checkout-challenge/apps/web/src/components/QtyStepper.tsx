import { Button } from './Button';

type Props = {
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  labelledBy: string;
  onChange: (value: number) => void;
};

export function QtyStepper({ value, min = 1, max, disabled, labelledBy, onChange }: Props) {
  return (
    <div className="qty" role="group" aria-labelledby={labelledBy}>
      <Button
        variant="ghost"
        className="qty__btn"
        disabled={disabled || value <= min}
        aria-label="Уменьшить количество"
        onClick={() => onChange(value - 1)}
      >
        −
      </Button>
      <span className="qty__value" aria-live="polite">
        {value}
      </span>
      <Button
        variant="ghost"
        className="qty__btn"
        disabled={disabled || value >= max}
        aria-label="Увеличить количество"
        onClick={() => onChange(value + 1)}
      >
        +
      </Button>
    </div>
  );
}
