import assert from "node:assert/strict";
import test from "node:test";

import { VooParseError, parseVooComponent } from "../src/index.js";

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
