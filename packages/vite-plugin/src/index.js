import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCore, repositoryRoot } from "./build-core.mjs";
import { generatedAdapterDefinition, generatedComponentBinding } from "./voo-codegen.js";
import { writeVooDeclarations } from "./voo-declarations.js";
import { parseVooComponent } from "./voo-parser.js";
import { readVooComponents } from "./voo-project.js";
import { compileVooStyle } from "./voo-style.js";

const componentExtension = ".voo";
const stylePrefix = "virtual:voya-style:";

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
      if (source.startsWith(stylePrefix)) return `\0${source}`;
      if (!source.endsWith(componentExtension) || !importer) return null;
      return resolve(importer, "..", source);
    },
    load(id) {
      if (id.startsWith(`\0${stylePrefix}`)) {
        const componentId = decodeURIComponent(id.slice(stylePrefix.length + 1, -4));
        const component = parseVooComponent(readFileSync(componentId, "utf8"), componentId);
        return compileVooStyle({ ...component, id: componentId });
      }
      if (!id.endsWith(componentExtension)) return null;
      const component = parseVooComponent(readFileSync(id, "utf8"), id);
      if (component.format === "source") {
        component.id = id;
        const { exportName } = generatedComponentBinding(component);
        const definition = generatedAdapterDefinition(component);
        const adapter = framework === "react" ? "@voyajs/react" : "@voyajs/vue";
        return `
          ${component.style ? `import "${stylePrefix}${encodeURIComponent(id)}.css";` : ""}
          import init, { ${exportName}, voo_abi_version } from "@voyajs/core";
          import { defineVoyaComponent } from "${adapter}";
          import { assertVooAbiVersion } from "@voyajs/vite-plugin/runtime";

          let bindings;
          async function loadBindings() {
            if (!bindings) {
              bindings = init().then(() => {
                assertVooAbiVersion(voo_abi_version());
                return { mount: ${exportName} };
              });
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
    abiVersion: generatedAdapterDefinition(component).abiVersion,
    name: component.name,
    props: component.props,
    events: component.events,
  };
}
