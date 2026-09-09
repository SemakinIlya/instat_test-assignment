import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  children: ReactNode;
};

export function Reveal({ open, children }: Props) {
  return (
    <div className={`reveal${open ? ' is-open' : ''}`} inert={open ? undefined : true}>
      <div className="reveal__inner">{children}</div>
    </div>
  );
}
