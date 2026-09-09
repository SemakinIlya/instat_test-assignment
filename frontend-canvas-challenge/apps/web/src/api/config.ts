/** From VITE_API_URL. */
export const apiBaseUrl = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export type HttpMethod = 'GET' | 'POST' | 'PUT';

export type HttpRequest = {
  method: HttpMethod;
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  ifMatch?: string;
  ifNoneMatch?: string;
  signal?: AbortSignal;
};
