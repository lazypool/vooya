import assert from "node:assert/strict";
import test from "node:test";

import {
  generateRustComponents,
  generatedAdapterDefinition,
  generatedComponentBinding,
  generatedScopeId,
} from "./voo-codegen.js";

const counter = {
  name: "Counter",
  props: [{ name: "initial", rustType: "i32", required: true }],
  rust: {
    content: "pub struct Component;\nimpl Component {\n    pub fn update_initial(&self, _: i32) {}\n    pub fn dispose(&mut self) {}\n}\npub fn mount(_: web_sys::Element, _: i32) -> Result<Component, wasm_bindgen::JsValue> { Ok(Component) }",
  },
};

test("generates a stable WASM component binding", () => {
  assert.deepEqual(generatedComponentBinding(counter), {
    exportName: "voo_counter_mount",
    handleName: "VooCounterHandle",
  });

  const generated = generateRustComponents([counter]);
  assert.match(generated, /mod voo_counter_component/);
  assert.match(generated, /pub struct VooCounterHandle\(voo_counter_component::Component\)/);
  assert.match(generated, /pub fn update_initial\(&self, value: i32\)/);
  assert.match(generated, /pub fn voo_counter_mount\(/);
  assert.match(generated, /voo_counter_component::mount\(host, initial\)/);
});

test("references extracted Rust sources for compiler diagnostics", () => {
  const component = { ...counter, id: "/app/Counter.voo" };
  const generated = generateRustComponents(
    [component],
    new Map([[component.id, "/build/Counter.rs"]]),
  );

  assert.match(generated, /#\[path = "\/build\/Counter.rs"\]/);
  assert.doesNotMatch(generated, /pub struct Component;/);
});

test("emits an empty generated module when an app has no source components", () => {
  const generated = generateRustComponents([]);
  assert.match(generated, /pub fn voo_abi_version\(\) -> u32/);
  assert.match(generated, /\n    1\n/);
  assert.doesNotMatch(generated, /pub fn voo_.*_mount/);
});

test("generates a serializable framework contract", () => {
  assert.deepEqual(
    generatedAdapterDefinition({
      ...counter,
      props: [
        { name: "initial", rustType: "i32", required: false, defaultValue: "2" },
        { name: "label", rustType: "String", required: false, defaultValue: '"Count"' },
      ],
      events: [{ name: "change", parameters: [{ name: "value", rustType: "i32" }] }],
    }),
    {
      abiVersion: 1,
      name: "Counter",
      props: [
        { name: "initial", type: "number", required: false, defaultValue: 2 },
        { name: "label", type: "string", required: false, defaultValue: "Count" },
      ],
      events: [{ name: "change", parameters: ["value"] }],
    },
  );
});

test("rejects prop types that cannot cross the generated ABI", () => {
  assert.throws(
    () =>
      generatedAdapterDefinition({
        ...counter,
        props: [{ name: "items", rustType: "Vec<String>", required: true }],
        events: [],
      }),
    /Unsupported Voo prop type/,
  );
});

test("generates a stable style scope from the component path", () => {
  const component = {
    ...counter,
    id: "/app/Counter.voo",
    style: { content: ".counter {}", scoped: true },
    events: [],
  };
  const definition = generatedAdapterDefinition(component);

  assert.equal(definition.scopeId, generatedScopeId(component));
  assert.match(definition.scopeId, /^voo-[a-f0-9]+$/);
  assert.notEqual(generatedScopeId(component), generatedScopeId({ ...component, id: "/other.voo" }));
});
