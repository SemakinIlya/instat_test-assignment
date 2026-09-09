export class ParseError extends Error {
  constructor(message = 'Не удалось разобрать ответ сервера.') {
    super(message);
    this.name = 'ParseError';
  }
}

/** 204/304 have no body. */
export async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 304) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ParseError();
  }
}

export function header(response: Response, name: string): string | null {
  return response.headers.get(name);
}

export function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get('Retry-After');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}
