import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

type Props = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

type ControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export function Field({ id, label, error, hint, children }: Props) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<ControlProps>, {
        id: (children.props as ControlProps).id ?? id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {control}
      <p
        className={error ? 'field__error' : 'field__hint'}
        id={describedBy}
        role={error ? 'alert' : undefined}
      >
        {error ?? hint ?? '\u00a0'}
      </p>
    </div>
  );
}
