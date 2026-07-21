import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildCore, repositoryRoot } from "./build-core.mjs";

const coreArtifact = resolve(repositoryRoot, "packages/core/dist/voya_core.js");

export function voya() {
  return {
    name: "voya",
    enforce: "pre",
    buildStart() {
      if (!existsSync(coreArtifact)) buildCore();
    },
    resolveId(source, importer) {
      if (!source.endsWith(".voya") || !importer) return null;
      return resolve(importer, "..", source);
    },
    load(id) {
      if (!id.endsWith(".voya")) return null;
      return `
        import init, { mount_counter } from "@voya/core";
        import { defineVoyaCounter } from "@voya/vue";

        let bindings;
        async function loadBindings() {
          if (!bindings) {
            bindings = init().then(() => ({ mount_counter }));
          }
          return bindings;
        }

        export default defineVoyaCounter(loadBindings);
      `;
    },
    configureServer(server) {
      const source = resolve(repositoryRoot, "crates/voya-core/src");
      server.watcher.add(source);
      server.watcher.on("change", (file) => {
        if (!file.startsWith(source)) return;
        buildCore();
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
