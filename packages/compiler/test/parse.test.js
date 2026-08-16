import assert from "node:assert/strict";
import test from "node:test";

import { VooParseError, generatedAdapterDefinition, parseVooComponent } from "../dist/index.js";

test("parses transitional manifests", () => {
  const component = parseVooComponent(`
component Counter
export: mount_counter
adapter:
vue: defineVooyaCounter
props:
initial: number required
events:
change: number
`, "Counter.voo");

  assert.equal(component.format, "manifest");
  assert.equal(component.name, "Counter");
  assert.equal(component.exportName, "mount_counter");
  assert.deepEqual(component.adapters, { vue: "defineVooyaCounter" });
  assert.deepEqual(component.props, [{ name: "initial", type: "number", required: true }]);
  assert.deepEqual(component.events, [{ name: "change", type: "number" }]);
});

test("parses source components into compiler input", () => {
  const component = parseVooComponent(`<component name="Counter">
props:
  initial: i32 = 0
  labels: Vec<String>
events:
  change(value: i32)
  select(id: u32, tags: Vec<String>)
</component>

<rust>
fn counter() {}
</rust>

<style scoped>
.counter { display: flex; }
</style>
`, "Counter.voo");

  assert.equal(component.format, "source");
  assert.equal(component.name, "Counter");
  assert.deepEqual(component.props, [
    { name: "initial", rustType: "i32", required: false, defaultValue: "0" },
    { name: "labels", rustType: "Vec<String>", required: true, defaultValue: undefined },
  ]);
  assert.deepEqual(component.events, [
    { name: "change", parameters: [{ name: "value", rustType: "i32" }] },
    {
      name: "select",
      parameters: [
        { name: "id", rustType: "u32" },
        { name: "tags", rustType: "Vec<String>" },
      ],
    },
  ]);
  assert.deepEqual(component.rust, { content: "fn counter() {}", startLine: 11 });
  assert.deepEqual(component.style, {
    content: ".counter { display: flex; }",
    scoped: true,
    startLine: 15,
  });
});

test("preserves // inside quoted contract defaults and handles escapes", () => {
  const component = parseVooComponent(`<component name="Link">
// full-line comment before props
props:
  href: String = "https://vooya.dev/docs"
  endpoint: String = "https://vooya.dev" // public documentation
  embedded: String = "a//b"
  escaped: String = "quoted \\"//\\" text" // note with //
events:
  click(url: String) // event comment
</component>

<rust>
fn link() {}
</rust>
`, "Link.voo");

  assert.equal(component.format, "source");
  assert.equal(component.name, "Link");
  assert.deepEqual(component.props, [
    { name: "href", rustType: "String", required: false, defaultValue: '"https://vooya.dev/docs"' },
    { name: "endpoint", rustType: "String", required: false, defaultValue: '"https://vooya.dev"' },
    { name: "embedded", rustType: "String", required: false, defaultValue: '"a//b"' },
    { name: "escaped", rustType: "String", required: false, defaultValue: '"quoted \\"//\\" text"' },
  ]);
  assert.deepEqual(component.events, [
    { name: "click", parameters: [{ name: "url", rustType: "String" }] },
  ]);

  const adapter = generatedAdapterDefinition(component);
  assert.deepEqual(adapter.props, [
    { name: "href", type: "string", required: false, defaultValue: "https://vooya.dev/docs" },
    { name: "endpoint", type: "string", required: false, defaultValue: "https://vooya.dev" },
    { name: "embedded", type: "string", required: false, defaultValue: "a//b" },
    { name: "escaped", type: "string", required: false, defaultValue: 'quoted "//" text' },
  ]);
});

test("preserves original source line mapping in diagnostics with comments and strings", () => {
  assert.throws(
    () =>
      parseVooComponent(`<component name="Link">
props:
  // comment line 3
  href: String = "https://vooya.dev/docs"
  invalid prop
</component>
<rust>fn link() {}</rust>`, "Link.voo"),
    (error) => {
      assert.ok(error instanceof VooParseError);
      assert.equal(error.id, "Link.voo");
      assert.equal(error.line, 6);
      assert.match(error.message, /Invalid prop declaration/);
      return true;
    },
  );
});

test("reports contract errors with the source line", () => {
  assert.throws(
    () =>
      parseVooComponent(`<component name="counter">
props:
  initial i32
</component>
<rust>fn counter() {}</rust>`, "Broken.voo"),
    (error) => {
      assert.ok(error instanceof VooParseError);
      assert.equal(error.id, "Broken.voo");
      assert.equal(error.line, 1);
      assert.match(error.message, /PascalCase/);
      return true;
    },
  );
});
