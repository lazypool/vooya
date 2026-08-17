import assert from "node:assert/strict";
import test from "node:test";

import { parseVooComponent } from "@vooya/compiler";

import { renderVooModule } from "../dist/module.js";

const source = `<component name="Counter">
props:
  initial: i32
events:
  changed(value: i32)
</component>
<rust>
pub fn mount(_context: Context) -> Result<Component, wasm_bindgen::JsValue> { Ok(Component {}) }
pub struct Component {}
impl Component { pub fn dispose(&mut self) {} pub fn update_initial(&self, _value: i32) {} }
</rust>`;

test("renders a Vue wrapper with the Webpack runtime and expected ABI", () => {
  const component = parseVooComponent(source, "/consumer/src/Counter.voo");
  assert.equal(component.format, "source");
  component.id = "/consumer/src/Counter.voo";
  const generated = renderVooModule({
    component,
    framework: "vue",
    runtimeModule: "/consumer/.vooya/wasm/webpack/1/vooya_app.js",
    styleModule: "/consumer/.vooya/cache/webpack/styles/counter.css",
  });
  assert.match(generated, /@vooya\/vue/);
  assert.match(generated, /@vooya\/webpack\/runtime/);
  assert.match(generated, /assertVooAbiVersion\(voo_abi_version\(\), 1\)/);
  assert.match(generated, /export const metadata/);
});

test("selects the React adapter", () => {
  const component = parseVooComponent(source, "/consumer/src/Counter.voo");
  assert.equal(component.format, "source");
  component.id = "/consumer/src/Counter.voo";
  const generated = renderVooModule({
    component,
    framework: "react",
    runtimeModule: "/consumer/.vooya/wasm/webpack/1/vooya_app.js",
  });
  assert.match(generated, /@vooya\/react/);
});
