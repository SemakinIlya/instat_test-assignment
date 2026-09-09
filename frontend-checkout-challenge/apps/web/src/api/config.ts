/** From VITE_API_URL. */
export const apiBaseUrl = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type HttpRequest = {
  method: HttpMethod;
  path: string;
  body?: unknown;
  token?: string | null;
  idempotencyKey?: string;
  signal?: AbortSignal;
};
