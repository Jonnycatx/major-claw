type EventHandler<T> = (event: T) => void;

export class EventBus<TEvent extends { type: string }> {
  private readonly listeners = new Map<string, Set<EventHandler<TEvent>>>();

  on(type: string, handler: EventHandler<TEvent>): () => void {
    const existing = this.listeners.get(type) ?? new Set<EventHandler<TEvent>>();
    existing.add(handler);
    this.listeners.set(type, existing);
    return () => this.off(type, handler);
  }

  off(type: string, handler: EventHandler<TEvent>): void {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }
    listeners.delete(handler);
  }

  emit(event: TEvent): void {
    const listeners = this.listeners.get(event.type);
    if (!listeners) {
      return;
    }
    for (const handler of listeners) {
      handler(event);
    }
  }
}
