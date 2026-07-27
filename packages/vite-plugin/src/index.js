import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
  buildApplication,
  resolveRuntimeCrateRoot,
  resolveRustDependencyRoots,
} from "./build-core.mjs";
import { createBuildScheduler } from "./build-scheduler.js";
import { generatedAdapterDefinition, generatedComponentBinding } from "./voo-codegen.js";
import { writeVooDeclarations } from "./voo-declarations.js";
import { parseVooComponent } from "./voo-parser.js";
import { readVooComponents } from "./voo-project.js";
import { compileVooStyle } from "./voo-style.js";

const componentExtension = ".voo";
const runtimeId = "virtual:voya-runtime";
const stylePrefix = "virtual:voya-style:";

export function voya({ framework = "vue", rust = {} } = {}) {
  let applicationRoot;
  let buildScheduler;
  let runtimeModule;
  let sourceComponents = [];
  let watchedRustRoots = [];

  const compile = () => {
    const components = applicationRoot ? readVooComponents(applicationRoot) : [];
    sourceComponents = components.filter((component) => component.format === "source");
    writeVooDeclarations(components, framework);
    ({ runtimeModule } = buildApplication({
      applicationRoot,
      components: sourceComponents,
      rust,
    }));
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
      if (source === runtimeId) return runtimeModule;
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
          import init, { ${exportName}, voo_abi_version } from "${runtimeId}";
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
      watchedRustRoots = [
        resolve(resolveRuntimeCrateRoot(), "src"),
        ...resolveRustDependencyRoots(rust, applicationRoot),
      ];
      server.watcher.add(watchedRustRoots);
      buildScheduler = createBuildScheduler({
        build: compile,
        onSuccess() {
          server.ws.send({ type: "full-reload" });
        },
        onError(cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          server.config.logger.error(error.stack ?? error.message);
          server.ws.send({
            type: "error",
            err: { message: error.message, stack: error.stack ?? "" },
          });
        },
      });
      server.httpServer?.once("close", () => buildScheduler?.dispose());
    },
    handleHotUpdate({ file }) {
      if (
        !file.endsWith(componentExtension) &&
        !watchedRustRoots.some((root) => isPathInside(file, root))
      ) {
        return;
      }
      buildScheduler?.schedule();
      return [];
    },
  };
}

function isPathInside(file, directory) {
  const path = relative(directory, file);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function componentMetadata(component) {
  return {
    abiVersion: generatedAdapterDefinition(component).abiVersion,
    name: component.name,
    props: component.props,
    events: component.events,
  };
}
