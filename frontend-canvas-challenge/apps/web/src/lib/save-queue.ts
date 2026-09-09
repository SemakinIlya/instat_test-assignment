export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

/** Debounced serial PUT. Reads graph/ETag from refs. Stops on 412 until reload. */
export class SaveQueue {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private queued = false;
  private paused = false;
  debounceMs = 500;

  constructor(
    private readonly save: () => Promise<void>,
    private readonly onQueued: () => void,
  ) {}

  bump(): void {
    this.queued = true;
    this.onQueued();
    if (this.paused) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch(() => undefined);
    }, this.debounceMs);
  }

  pause(): void {
    this.paused = true;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  async flush(): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.paused) return;
    if (this.running) {
      await this.running;
      if (this.queued && !this.paused) return this.flush();
      return;
    }
    this.running = this.drain();
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }

  dispose(): void {
    this.pause();
    this.queued = false;
  }

  reset(): void {
    this.paused = false;
    this.queued = false;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private async drain(): Promise<void> {
    while (this.queued && !this.paused) {
      this.queued = false;
      try {
        await this.save();
      } catch (error) {
        this.queued = true;
        throw error;
      }
    }
  }
}
