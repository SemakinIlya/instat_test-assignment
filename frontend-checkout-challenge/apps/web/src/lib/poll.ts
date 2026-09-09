export async function pollUntil<T>(
  read: (signal: AbortSignal) => Promise<T>,
  isDone: (value: T) => boolean,
  signal: AbortSignal,
  intervalMs: number,
  firstDelayMs = 0,
): Promise<T> {
  if (firstDelayMs > 0) await sleep(firstDelayMs, signal);
  let value = await read(signal);
  while (!signal.aborted && !isDone(value)) {
    await sleep(intervalMs, signal);
    value = await read(signal);
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return value;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}
