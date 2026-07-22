import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCore, repositoryRoot } from "./build-core.mjs";

export function voya({ framework = "vue" } = {}) {
  return {
    name: "voya",
    enforce: "pre",
    buildStart() {
      buildCore();
    },
    resolveId(source, importer) {
      if (!source.endsWith(".voya") || !importer) return null;
      return resolve(importer, "..", source);
    },
    load(id) {
      if (!id.endsWith(".voya")) return null;
      const component = readFileSync(id, "utf8").trim();
      const adapter = framework === "react" ? "@voyajs/react" : "@voyajs/vue";
      if (component === "data-grid") {
        if (framework === "react") {
          this.error("The Stage 5 React adapter currently supports counter islands only.");
        }
        return `
          import init, { mount_data_grid } from "@voyajs/core";
        import { defineVoyaDataGrid } from "${adapter}";

          let bindings;
          async function loadBindings() {
            if (!bindings) bindings = init().then(() => ({ mount_data_grid }));
            return bindings;
          }

          export default defineVoyaDataGrid(loadBindings);
        `;
      }
      if (component === "task-list") {
        if (framework === "react") {
          this.error("The Stage 5 React adapter currently supports counter islands only.");
        }
        return `
          import init, { mount_task_list } from "@voyajs/core";
        import { defineVoyaTaskList } from "${adapter}";

          let bindings;
          async function loadBindings() {
            if (!bindings) bindings = init().then(() => ({ mount_task_list }));
            return bindings;
          }

          export default defineVoyaTaskList(loadBindings);
        `;
      }
      if (component !== "counter") {
        this.error(`Unknown Voya component kind in ${id}: ${component}`);
      }
      return `
        import init, { mount_counter } from "@voyajs/core";
        import { defineVoyaCounter } from "${adapter}";

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
