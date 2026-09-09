import { apiBaseUrl, type HttpRequest } from './config';

export function buildHeaders(request: HttpRequest): Headers {
  const headers = new Headers();
  if (request.body !== undefined) headers.set('Content-Type', 'application/json');
  if (request.token) headers.set('Authorization', `Bearer ${request.token}`);
  if (request.idempotencyKey) headers.set('Idempotency-Key', request.idempotencyKey);
  return headers;
}

export function buildUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export function toFetchInit(request: HttpRequest): [string, RequestInit] {
  return [
    buildUrl(request.path),
    {
      method: request.method,
      headers: buildHeaders(request),
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: request.signal,
    },
  ];
}

/** fetch. Status and JSON are handled in parse/errors. */
export async function send(request: HttpRequest): Promise<Response> {
  const [url, init] = toFetchInit(request);
  try {
    return await fetch(url, init);
  } catch (cause) {
    if (request.signal?.aborted) throw cause;
    throw new NetworkError(cause);
  }
}

export class NetworkError extends Error {
  readonly cause: unknown;

  constructor(cause?: unknown) {
    super('Нет соединения с сервером. Проверьте сеть и повторите попытку.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}
