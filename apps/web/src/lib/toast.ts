type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function toast(message: string): void {
  for (const listener of listeners) listener(message);
}

export function onToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
