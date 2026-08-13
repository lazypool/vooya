import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import oniguruma from "vscode-oniguruma";
import textmate from "vscode-textmate";

const { createOnigScanner, createOnigString, loadWASM } = oniguruma;
const { INITIAL, Registry, parseRawGrammar } = textmate;

const root = fileURLToPath(new URL("../..", import.meta.url));
const extensionRoot = resolve(root, "editors/vscode");
const runtimeRoot = resolve(extensionRoot, "runtime/vooya-core");
const canonicalRuntimeRoot = resolve(root, "packages/core/rust");
const manifest = readJson("package.json");
const grammar = readJson("syntaxes/voo.tmLanguage.json");
const language = readJson("language-configuration.json");
const fixture = readFileSync(resolve(root, "examples/vue-counter/src/Counter.voo"), "utf8");
const manifestFixture = `component LegacyCounter
runtime: @vooya/core
export: mount_counter
adapter:
  vue: createVooyaComponent
props:
  initial: number required
events:
  change: number`;

for (const relativePath of ["Cargo.toml", "src/lib.rs", "src/reactive.rs", "src/view.rs"]) {
  assert(
    readFileSync(resolve(runtimeRoot, relativePath), "utf8") === readFileSync(resolve(canonicalRuntimeRoot, relativePath), "utf8"),
    `VS Code bundled runtime drifted from packages/core/rust/${relativePath}; sync it before packaging.`,
  );
}

const contribution = manifest.contributes.languages.find(({ id }) => id === "voo");
assert(contribution?.extensions.includes(".voo"), "VS Code must associate .voo files.");

const grammarContribution = manifest.contributes.grammars.find(
  ({ language: id }) => id === "voo",
);
assert(grammarContribution?.scopeName === "source.voo", "Voo grammar scope is missing.");
assert(
  grammarContribution.embeddedLanguages["meta.embedded.block.rust"] === "rust",
  "Rust embedded language mapping is missing.",
);
assert(
  grammarContribution.embeddedLanguages["meta.embedded.block.css"] === "css",
  "CSS embedded language mapping is missing.",
);

const includes = collectIncludes(grammar);
assert(includes.has("source.rust"), "Voo grammar must include the native Rust grammar.");
assert(includes.has("source.css"), "Voo grammar must include the native CSS grammar.");
assert(language.comments.lineComment === "//", "Voo line comments must use //.");

for (const tag of ["component", "rust", "style"]) {
  assert(fixture.includes(`<${tag}`), `Editor fixture is missing <${tag}>.`);
  assert(fixture.includes(`</${tag}>`), `Editor fixture is missing </${tag}>.`);
}
assert(/^props:$/m.test(fixture), "Editor fixture must exercise props.");
assert(/^events:$/m.test(fixture), "Editor fixture must exercise events.");

const tokens = await tokenizeSource(`${fixture}\n${manifestFixture}`);
assert(hasScope(tokens, "props", "keyword.control.section.voo"), "props: is not highlighted.");
assert(hasScope(tokens, "initial", "variable.other.member.voo"), "Prop names are not highlighted.");
assert(hasScope(tokens, "i32", "entity.name.type.rust"), "Contract Rust types are not highlighted.");
assert(
  hasScope(tokens, "pub", "keyword.control.rust", "meta.embedded.block.rust"),
  "The <rust> block is not tokenized as embedded Rust.",
);
assert(
  hasScope(tokens, ".vooya-counter", "entity.other.attribute-name.class.css", "meta.embedded.block.css"),
  "The <style> block is not tokenized as embedded CSS.",
);
assert(
  hasScope(tokens, "LegacyCounter", "entity.name.type.component.voo"),
  "Legacy manifest component declarations are not highlighted.",
);
assert(
  hasScope(tokens, "runtime", "variable.other.member.voo"),
  "Legacy manifest fields are not highlighted.",
);
assert(
  hasScope(tokens, "vue", "support.type.framework.voo"),
  "Legacy manifest adapters are not highlighted.",
);

console.log("Verified VS Code language configuration and embedded Voo grammars.");

function readJson(path) {
  return JSON.parse(readFileSync(resolve(extensionRoot, path), "utf8"));
}

function collectIncludes(value, includes = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectIncludes(item, includes);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "include") includes.add(item);
      else collectIncludes(item, includes);
    }
  }
  return includes;
}

async function tokenizeSource(source) {
  const require = createRequire(import.meta.url);
  const wasm = readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm"));
  await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

  const embedded = {
    "source.rust": {
      scopeName: "source.rust",
      patterns: [{ match: "\\b(?:fn|pub|struct|use)\\b", name: "keyword.control.rust" }],
    },
    "source.css": {
      scopeName: "source.css",
      patterns: [
        {
          match: "\\.[A-Za-z_-][\\w-]*",
          name: "entity.other.attribute-name.class.css",
        },
      ],
    },
  };
  const registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner, createOnigString }),
    loadGrammar: async (scopeName) => {
      if (scopeName === grammar.scopeName) {
        return parseRawGrammar(JSON.stringify(grammar), "voo.tmLanguage.json");
      }
      const source = embedded[scopeName];
      return source ? parseRawGrammar(JSON.stringify(source), `${scopeName}.json`) : null;
    },
  });
  const vooGrammar = await registry.loadGrammar(grammar.scopeName);
  assert(vooGrammar, "TextMate could not load the Voo grammar.");

  const tokens = [];
  let ruleStack = INITIAL;
  for (const line of source.split(/\r?\n/)) {
    const result = vooGrammar.tokenizeLine(line, ruleStack);
    ruleStack = result.ruleStack;
    for (const token of result.tokens) {
      tokens.push({
        scopes: token.scopes,
        text: line.slice(token.startIndex, token.endIndex),
      });
    }
  }
  return tokens;
}

function hasScope(tokens, text, ...scopes) {
  return tokens.some(
    (token) => token.text.includes(text) && scopes.every((scope) => token.scopes.includes(scope)),
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
