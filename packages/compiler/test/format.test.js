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

test("formats quoted contract defaults containing // and preserves comments", () => {
  const source = `<component name="Link">
 props:
 href:String="https://vooya.dev/docs"
 endpoint: String = "https://vooya.dev" // public documentation
 embedded: String = "a//b"
 escaped: String = "quoted \\"//\\" text" // trailing comment with //
 events:
 navigate( target : String ) // navigate handler
</component>
<rust>
fn mount() {}
</rust>`;

  const expected = `<component name="Link">
props:
  href: String = "https://vooya.dev/docs"
  endpoint: String = "https://vooya.dev" // public documentation
  embedded: String = "a//b"
  escaped: String = "quoted \\"//\\" text" // trailing comment with //

events:
  navigate(target: String) // navigate handler
</component>

<rust>
fn mount() {}
</rust>
`;

  const formatted = formatVooComponent(source, "Link.voo");
  assert.equal(formatted, expected);
  assert.equal(formatVooComponent(formatted, "Link.voo"), expected);
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
