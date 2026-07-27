import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildCore, repositoryRoot } from "./build-core.mjs";
import { generatedAdapterDefinition, generatedComponentBinding } from "./voo-codegen.js";
import { parseVooComponent } from "./voo-parser.js";

const componentExtension = ".voo";

export function voya({ framework = "vue" } = {}) {
  let applicationRoot;
  let sourceComponents = [];

  const compile = () => {
    sourceComponents = applicationRoot ? readSourceComponents(applicationRoot) : [];
    buildCore(repositoryRoot, sourceComponents);
  };

  return {
    name: "voya",
    enforce: "pre",
    configResolved(config) {
      applicationRoot = config.root;
    },
    buildStart() {
      compile();
    },
    resolveId(source, importer) {
      if (!source.endsWith(componentExtension) || !importer) return null;
      return resolve(importer, "..", source);
    },
    load(id) {
      if (!id.endsWith(componentExtension)) return null;
      const component = parseVooComponent(readFileSync(id, "utf8"), id);
      if (component.format === "source") {
        if (framework !== "vue") {
          this.error(`Source components currently support Vue only: ${id}.`);
        }
        const { exportName } = generatedComponentBinding(component);
        const definition = generatedAdapterDefinition(component);
        return `
          import init, { ${exportName} } from "@voyajs/core";
          import { defineVoyaComponent } from "@voyajs/vue";

          let bindings;
          async function loadBindings() {
            if (!bindings) {
              bindings = init().then(() => ({ mount: ${exportName} }));
            }
            return bindings;
          }

          export const metadata = ${JSON.stringify(componentMetadata(component))};
          export default defineVoyaComponent(${JSON.stringify(definition)}, loadBindings);
        `;
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
        if (!file.startsWith(source) && !file.endsWith(componentExtension)) return;
        compile();
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}

function readSourceComponents(root) {
  return readVooFiles(root)
    .map((id) => parseVooComponent(readFileSync(id, "utf8"), id))
    .filter((component) => component.format === "source");
}

function readVooFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...readVooFiles(path));
    else if (entry.isFile() && entry.name.endsWith(componentExtension)) files.push(path);
  }
  return files;
}

function componentMetadata(component) {
  return {
    name: component.name,
    props: component.props,
    events: component.events,
  };
}
