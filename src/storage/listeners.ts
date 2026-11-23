/** Tiny listener set shared by the storage adapters to implement `Storage.subscribe`. */
export class Listeners {
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (err) {
        console.error('[storage] listener failed', err);
      }
    }
  }
}
