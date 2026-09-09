import type { SaveStatus } from '@/lib/save-queue';

const COPY: Record<SaveStatus, { label: string; tone: string }> = {
  saved: { label: 'Сохранено', tone: 'ok' },
  dirty: { label: 'Не сохранено', tone: 'wait' },
  saving: { label: 'Сохраняем…', tone: 'wait' },
  error: { label: 'Ошибка сохранения', tone: 'error' },
  conflict: { label: 'Конфликт версии', tone: 'error' },
};

export function SaveBadge({ status }: { status: SaveStatus }) {
  const copy = COPY[status];
  return (
    <p className={`save-badge save-badge--${copy.tone}`} aria-live="polite">
      {copy.label}
    </p>
  );
}
