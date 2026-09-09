import type { ReactNode } from 'react';

type Props = {
  tone?: 'info' | 'error' | 'ok' | 'wait';
  children: ReactNode;
};

export function Notice({ tone = 'info', children }: Props) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
