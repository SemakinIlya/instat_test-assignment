import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SpaceData } from '@canvas/contracts';
import { api, reportError } from '@/api';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Notice } from '@/components/Notice';
import { Spinner } from '@/components/Spinner';
import { readJson } from '@/lib/storage';

export function SpacesPage() {
  const navigate = useNavigate();
  const lastSpaceId = readJson<string | null>('lastSpaceId', null);
  const [spaces, setSpaces] = useState<SpaceData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('Мой канвас');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const boot = new AbortController();
    void api
      .spaces(boot.signal)
      .then((result) => setSpaces(result.data))
      .catch((cause: unknown) => {
        reportError(cause, setError);
      });
    return () => boot.abort();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('Введите название.');
      return;
    }
    if (trimmed.length > 80) {
      setTitleError('Не больше 80 символов.');
      return;
    }
    setTitleError(undefined);
    setCreating(true);
    try {
      const result = await api.createSpace(trimmed);
      navigate(`/spaces/${result.data.id}`);
    } catch (cause) {
      reportError(cause, setError);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-shell page">
      <header className="page__intro">
        <p className="eyebrow">Рабочие пространства</p>
        <h1>Соберите цепочку и запустите тестовую генерацию</h1>
        <p className="lede">
          Три ноды: текст, генератор и результат. Связи тянутся между портами. Сохранение идёт на
          сервер с паузой 500 мс.
        </p>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <form className="card create-space" onSubmit={(event) => void onCreate(event)}>
        <Field id="space-title" label="Название пространства" error={titleError}>
          <input
            id="space-title"
            name="title"
            value={title}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Button type="submit" disabled={creating}>
          {creating ? 'Создаём…' : 'Создать и открыть'}
        </Button>
      </form>
      {!spaces && !error ? <Spinner label="Загружаем список" /> : null}
      {spaces && spaces.length === 0 ? (
        <p className="muted">Пока нет пространств — создайте первое.</p>
      ) : null}
      {spaces && spaces.length > 0 ? (
        <ul className="space-list">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link className="card space-card" to={`/spaces/${space.id}`}>
                <span className="space-card__title">{space.title}</span>
                <span className="muted">
                  {new Date(space.createdAt).toLocaleString('ru')}
                  {space.id === lastSpaceId ? ' · последнее' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
