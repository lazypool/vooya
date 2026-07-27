import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCore, repositoryRoot } from "./build-core.mjs";

const componentExtension = ".voo";
const defaultRuntime = "@voyajs/core";

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

        export const metadata = ${JSON.stringify(component.metadata)};
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

function parseVooComponent(source, id) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);

  const declaration = lines.shift();
  const componentMatch = declaration?.match(/^component\s+([A-Z][A-Za-z0-9_]*)$/);
  if (!componentMatch) {
    throw new Error(`Invalid Voo component declaration in ${id}. Expected "component Name".`);
  }

  const component = {
    name: componentMatch[1],
    runtime: defaultRuntime,
    exportName: undefined,
    adapters: {},
    props: [],
    events: [],
  };
  let section = "root";

  for (const line of lines) {
    const sectionMatch = line.match(/^(adapter|props|events):$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    if (section === "root") {
      const fieldMatch = line.match(/^([a-z][a-z0-9-]*)\s*:\s*(.+)$/);
      if (!fieldMatch) throw new Error(`Invalid Voo field in ${id}: ${line}`);
      const [, key, value] = fieldMatch;
      if (key === "runtime") {
        component.runtime = value;
      } else if (key === "export") {
        component.exportName = value;
      } else {
        throw new Error(`Unknown Voo field in ${id}: ${key}`);
      }
      continue;
    }

    if (section === "adapter") {
      const adapterMatch = line.match(/^(vue|react)\s*:\s*([A-Za-z_$][\w$]*)$/);
      if (!adapterMatch) throw new Error(`Invalid Voo adapter field in ${id}: ${line}`);
      component.adapters[adapterMatch[1]] = adapterMatch[2];
      continue;
    }

    if (section === "props") {
      const propMatch = line.match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z][\w<>[\]|]*)\s*(required)?$/);
      if (!propMatch) throw new Error(`Invalid Voo prop field in ${id}: ${line}`);
      component.props.push({
        name: propMatch[1],
        type: propMatch[2],
        required: propMatch[3] === "required",
      });
      continue;
    }

    if (section === "events") {
      const eventMatch = line.match(/^([A-Za-z_$][\w$-]*)\s*:\s*([A-Za-z][\w<>[\]|]*)$/);
      if (!eventMatch) throw new Error(`Invalid Voo event field in ${id}: ${line}`);
      component.events.push({ name: eventMatch[1], type: eventMatch[2] });
    }
  }

  if (!component.exportName) {
    throw new Error(`Voo component ${component.name} is missing "export".`);
  }
  if (!isIdentifier(component.exportName)) {
    throw new Error(`Voo component ${component.name} has invalid export "${component.exportName}".`);
  }

  return {
    ...component,
    metadata: {
      name: component.name,
      runtime: component.runtime,
      export: component.exportName,
      adapters: component.adapters,
      props: component.props,
      events: component.events,
    },
  };
}

function isIdentifier(value) {
  return /^[A-Za-z_$][\w$]*$/.test(value);
}
