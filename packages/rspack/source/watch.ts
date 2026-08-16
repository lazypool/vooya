import { dirname, isAbsolute, normalize, relative, resolve } from "node:path";

export function hasWatchedRustChange(
  modifiedFiles: ReadonlySet<string> | undefined,
  watchedRoots: string[],
  watchedFiles: string[],
  applicationRoot: string,
): boolean {
  const absoluteFiles = new Set(watchedFiles.map((file) => resolve(file)));
  const relativeFiles = new Set(
    watchedFiles.flatMap((file) => [
      normalize(relative(applicationRoot, file)),
      ...watchedRoots.flatMap((root) => [
        normalize(relative(root, file)),
        normalize(relative(dirname(root), file)),
      ]),
    ]),
  );
  return [...(modifiedFiles ?? [])].some((file) =>
    isAbsolute(file) ? absoluteFiles.has(resolve(file)) : relativeFiles.has(normalize(file)),
  );
}
