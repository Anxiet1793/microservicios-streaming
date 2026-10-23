export class PlaybackQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private latest: { position: number; send: (position: number) => Promise<unknown> } | undefined;
  private progressScheduled = false;
  stopped = false;
  run<T>(action: () => Promise<T>): Promise<T> {
    const next = this.tail
      .catch(() => undefined)
      .then(() => {
        if (this.stopped) throw new Error("PLAYER_STOPPED");
        return action();
      });
    this.tail = next;
    return next;
  }
  progress(position: number, send: (position: number) => Promise<unknown>) {
    this.latest = { position, send };
    if (this.progressScheduled) return this.tail;
    this.progressScheduled = true;
    return this.run(async () => {
      try {
        while (this.latest && !this.stopped) {
          const task = this.latest;
          this.latest = undefined;
          await task.send(task.position);
        }
      } finally {
        this.progressScheduled = false;
      }
    });
  }
  stop() {
    this.stopped = true;
    this.latest = undefined;
  }
}
