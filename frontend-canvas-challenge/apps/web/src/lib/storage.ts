const PREFIX = 'canvas-space.';

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function takeIdempotencyKey(storageKey: string, fingerprint: string): string {
  const saved = readJson<{ fingerprint: string; key: string; done?: boolean } | null>(
    storageKey,
    null,
  );
  if (saved && saved.fingerprint === fingerprint && !saved.done) return saved.key;
  const key = crypto.randomUUID();
  writeJson(storageKey, { fingerprint, key, done: false });
  return key;
}

export function completeIdempotencyKey(storageKey: string, fingerprint: string): void {
  const saved = readJson<{ fingerprint: string; key: string; done?: boolean } | null>(
    storageKey,
    null,
  );
  if (saved && saved.fingerprint === fingerprint) writeJson(storageKey, { ...saved, done: true });
}

export function expireIdempotencyKey(storageKey: string): void {
  const saved = readJson<{ fingerprint: string; key: string; done?: boolean } | null>(
    storageKey,
    null,
  );
  if (saved) writeJson(storageKey, { ...saved, done: true });
}
