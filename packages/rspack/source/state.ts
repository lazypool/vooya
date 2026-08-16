type BuildState = {
  runtimeModule: string;
  wasm: Buffer;
  styleModules: Map<string, string>;
  watchedFiles: string[];
};

const states = new Map<string, BuildState>();

export function setBuildState(id: string, state: BuildState): void {
  states.set(id, state);
}

export function getBuildState(id: string): BuildState | undefined {
  return states.get(id);
}

export function deleteBuildState(id: string): void {
  states.delete(id);
}
