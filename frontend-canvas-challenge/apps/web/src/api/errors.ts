export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

const MESSAGES: Record<string, string> = {
  GRAPH_VERSION_CONFLICT:
    'Граф на сервере изменился. Локальные правки на экране. Можно загрузить серверную версию.',
  PRECONDITION_REQUIRED: 'Не передан ETag графа. Перечитайте канвас и сохраните снова.',
  INVALID_GRAPH:
    'Связи: текст → генератор и генератор → результат. У входа одна связь, у генератора один результат.',
  GRAPH_CHANGED: 'Сначала сохраните текущий граф, затем запускайте генерацию.',
  GENERATION_IN_PROGRESS: 'У этой ноды уже идёт генерация. Дождитесь результата.',
  IDEMPOTENCY_CONFLICT: 'Этот ключ уже использован с другими данными. Запустите генерацию заново.',
  GENERATOR_REQUIRED: 'Запускайте генерацию с ноды генератора.',
  INCOMPLETE_CHAIN: 'Соедините непустой текст, генератор и результат.',
  SPACE_NOT_FOUND: 'Рабочее пространство не найдено.',
  GENERATION_NOT_FOUND: 'Генерация не найдена.',
  PARSE_ERROR: 'Не удалось разобрать ответ сервера.',
};

type ErrorBody = { error?: { code?: string; message?: string } };

export function mapError(
  status: number,
  payload: unknown,
  requestId?: string | null,
): ApiClientError {
  const body = payload as ErrorBody;
  const code = body?.error?.code ?? 'UNKNOWN';
  const message = MESSAGES[code] ?? body?.error?.message ?? 'Не удалось выполнить запрос.';
  return new ApiClientError(status, code, message, requestId ?? undefined);
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function userMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Не удалось выполнить запрос.';
}

/** Ignore abort. */
export function reportError(error: unknown, setError: (message: string) => void): boolean {
  if (isAbortError(error)) return false;
  setError(userMessage(error));
  return true;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}
