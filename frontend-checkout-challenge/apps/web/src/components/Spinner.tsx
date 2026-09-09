export function Spinner({ label = 'Загрузка' }: { label?: string }) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <span className="spinner__dot" aria-hidden="true" />
      {label}
    </div>
  );
}
