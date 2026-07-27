import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCore, repositoryRoot } from "./build-core.mjs";
import { parseVooComponent } from "./voo-parser.js";

const componentExtension = ".voo";

export function voya({ framework = "vue" } = {}) {
  return {
    name: "voya",
    enforce: "pre",
    buildStart() {
      buildCore();
    },
    resolveId(source, importer) {
      if (!source.endsWith(componentExtension) || !importer) return null;
      return resolve(importer, "..", source);
    },
    load(id) {
      if (!id.endsWith(componentExtension)) return null;
      const component = parseVooComponent(readFileSync(id, "utf8"), id);
      if (component.format !== "manifest") {
        this.error(`Source component compilation is not available yet for ${id}.`);
      }
      const adapter = framework === "react" ? "@voyajs/react" : "@voyajs/vue";
      const factory = component.adapters[framework];
      if (!factory) {
        this.error(`Unsupported Voo component ${component.name} for framework ${framework}.`);
      }

      return `
        import init, { ${component.exportName} } from "${component.runtime}";
        import { ${factory} } from "${adapter}";

        let bindings;
        async function loadBindings() {
          if (!bindings) {
            bindings = init().then(() => ({ ${component.exportName} }));
          }
          return bindings;
        }

        export const metadata = ${JSON.stringify({
          name: component.name,
          runtime: component.runtime,
          export: component.exportName,
          adapters: component.adapters,
          props: component.props,
          events: component.events,
        })};
        export default ${factory}(loadBindings);
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
