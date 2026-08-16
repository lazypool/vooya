import assert from "node:assert/strict";
import test from "node:test";

import { parseVooComponent } from "@vooya/compiler";
import { renderVooModule } from "../dist/module.js";

test("renders a source .voo wrapper that imports the build-core runtime and framework adapter", () => {
  const component = parseVooComponent(`<component name="Counter">
props:
  initial: i32 = 0
events:
  change(value: i32)
</component>
<rust>pub struct Component;</rust>`, "/app/Counter.voo");
  component.id = "/app/Counter.voo";
  const module = renderVooModule({ component, framework: "vue", runtimeModule: "/cache/vooya_app.js", styleModule: "/cache/Counter.css" });
  assert.match(module, /import "\/cache\/Counter\.css"/);
  assert.match(module, /from "\/cache\/vooya_app\.js"/);
  assert.match(module, /from "@vooya\/vue"/);
  assert.match(module, /from "@vooya\/rspack\/runtime"/);
  assert.match(module, /voo_counter_mount/);
});
