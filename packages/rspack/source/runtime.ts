const initializers = new WeakMap<Function, Promise<unknown>>();

export function initializeWasm(initializer: Function): Promise<unknown> {
  const existing = initializers.get(initializer);
  if (existing) return existing;
  const initialization = Promise.resolve().then(() => initializer());
  initializers.set(initializer, initialization);
  void initialization.catch(() => {
    if (initializers.get(initializer) === initialization) initializers.delete(initializer);
  });
  return initialization;
}

export function assertVooAbiVersion(actual: number, expected: number): void {
  if (actual === expected) return;
  throw new Error(`Vooya ABI mismatch: compiler expects ${expected}, but WASM provides ${String(actual)}.`);
}
