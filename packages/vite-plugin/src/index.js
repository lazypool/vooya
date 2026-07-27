import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCore, repositoryRoot } from "./build-core.mjs";
import { generatedAdapterDefinition, generatedComponentBinding } from "./voo-codegen.js";
import { writeVooDeclarations } from "./voo-declarations.js";
import { parseVooComponent } from "./voo-parser.js";
import { readVooComponents } from "./voo-project.js";

const componentExtension = ".voo";

export function voya({ framework = "vue" } = {}) {
  let applicationRoot;
  let sourceComponents = [];

  const compile = () => {
    const components = applicationRoot ? readVooComponents(applicationRoot) : [];
    sourceComponents = components.filter((component) => component.format === "source");
    writeVooDeclarations(components, framework);
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
        const { exportName } = generatedComponentBinding(component);
        const definition = generatedAdapterDefinition(component);
        const adapter = framework === "react" ? "@voyajs/react" : "@voyajs/vue";
        return `
          import init, { ${exportName} } from "@voyajs/core";
          import { defineVoyaComponent } from "${adapter}";

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

function componentMetadata(component) {
  return {
    name: component.name,
    props: component.props,
    events: component.events,
  };
}
