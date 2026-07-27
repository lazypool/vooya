export const VOO_ABI_VERSION = 1;

export function assertVooAbiVersion(actual) {
  if (actual === VOO_ABI_VERSION) return;
  throw new Error(
    `Voya ABI mismatch: compiler expects ${VOO_ABI_VERSION}, but WASM provides ${String(actual)}.`,
  );
}
