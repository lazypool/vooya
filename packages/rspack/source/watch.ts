import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function fingerprintWatchedRustFiles(files: string[]): string {
  const fingerprint = createHash("sha256");
  for (const file of [...files].sort()) {
    fingerprint.update(file);
    fingerprint.update("\0");
    fingerprint.update(readFileSync(file));
    fingerprint.update("\0");
  }
  return fingerprint.digest("hex");
}
