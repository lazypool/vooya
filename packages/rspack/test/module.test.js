import assert from "node:assert/strict";
import test from "node:test";

import { parseVooComponent } from "@vooya/compiler";
import vooyaRspackLoader from "../dist/loader.js";
import { renderVooModule } from "../dist/module.js";
import { deleteBuildState, setBuildState } from "../dist/state.js";

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

test("disables loader caching because the wrapper depends on the current WASM build identity", () => {
  const instanceId = "loader-cache-test";
  const resourcePath = "/app/Counter.voo";
  const cacheableCalls = [];
  setBuildState(instanceId, {
    runtimeModule: "/cache/vooya_app.js?vooya-build=next",
    wasm: new Uint8Array(),
    wasmAssetName: "vooya_app_bg-next.wasm",
    styleModules: new Map(),
  });
  try {
    const module = vooyaRspackLoader.call({
      resourcePath,
      cacheable(value) { cacheableCalls.push(value); },
      getOptions() { return { framework: "vue", instanceId }; },
      addDependency() {},
    }, `<component name="Counter">
</component>
<rust>pub struct Component;</rust>`);
    assert.deepEqual(cacheableCalls, [false]);
    assert.match(module, /vooya-build=next/);
  } finally {
    deleteBuildState(instanceId);
  }
});
