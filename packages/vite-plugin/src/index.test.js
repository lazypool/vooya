import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { vooya } from "./index.js";

test("uses compiler output when generating a source component virtual module", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vooya-plugin-"));
  const id = resolve(root, "Counter.voo");
  writeFileSync(id, `<component name="Counter">
props:
  initial: i32 = 0
events:
  change(value: i32)
</component>
<rust>pub struct Component;</rust>
<style scoped>.counter { color: red; }</style>`);
  try {
    const plugin = vooya();
    plugin.configResolved({ root });

    const output = plugin.load.call({}, id);
    assert.match(output, /voo_counter_mount/);
    assert.match(output, /scopeId/);
    assert.match(output, /"initial","type":"number","required":false,"defaultValue":0/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
