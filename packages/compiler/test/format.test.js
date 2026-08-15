import assert from "node:assert/strict";
import test from "node:test";

import { formatVooComponent } from "../dist/index.js";

test("formats source contracts while preserving Rust, CSS, and comments", () => {
  const formatted = formatVooComponent(`<component   name="Counter" >
 props:
 initial:i32=0 // starting value
 // emitted after a click
 events:
 change( value : i32 )
</component>
<rust>
fn mount() {
    // Rust spacing stays untouched.
}
</rust>
<style scoped>
.counter { display:flex }
</style>`, "Counter.voo");

  assert.equal(
    formatted,
    `<component name="Counter">
props:
  initial: i32 = 0 // starting value
  // emitted after a click

events:
  change(value: i32)
</component>

<rust>
fn mount() {
    // Rust spacing stays untouched.
}
</rust>

<style scoped>
.counter { display:flex }
</style>
`,
  );
  assert.equal(formatVooComponent(formatted, "Counter.voo"), formatted);
});

test("formats components without contracts or styles", () => {
  assert.equal(
    formatVooComponent(
      '<component name="Empty">\n</component>\n\n<rust>\npub struct Component;\n</rust>',
      "Empty.voo",
    ),
    '<component name="Empty">\n</component>\n\n<rust>\npub struct Component;\n</rust>\n',
  );
});

test("refuses to discard unknown top-level content", () => {
  assert.throws(
    () =>
      formatVooComponent(
        '<component name="Counter"></component>\nkeep me\n<rust>fn mount() {}</rust>',
        "Counter.voo",
      ),
    /Cannot safely format top-level content/,
  );
});
