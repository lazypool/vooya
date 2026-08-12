import assert from "node:assert/strict";
import test from "node:test";

import { compileVooStyle } from "../src/index.js";

const component = {
  id: "/app/Counter.voo",
  name: "Counter",
  style: {
    content: `.counter, button { display: flex; }
:host { color: red; }
@media (width < 500px) { .counter { display: block; } }
@keyframes pulse { from { opacity: 0; } to { opacity: 1; } }`,
    scoped: true,
  },
};

test("prefixes component selectors with a stable host scope", () => {
  const css = compileVooStyle(component);
  assert.match(css, /\[data-voo-scope="voo-[a-f0-9]+"\] \.counter/);
  assert.match(css, /\[data-voo-scope="voo-[a-f0-9]+"\] button/);
  assert.match(css, /\[data-voo-scope="voo-[a-f0-9]+"\] \{ color: red; \}/);
  assert.match(css, /@media[^}]+\[data-voo-scope=/s);
  assert.match(css, /@keyframes pulse \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/);
  assert.doesNotMatch(css, /data-voo-scope[^}]+from/);
});

test("leaves unscoped styles unchanged", () => {
  assert.equal(
    compileVooStyle({
      ...component,
      style: { content: ".counter { display: flex; }", scoped: false },
    }),
    ".counter { display: flex; }",
  );
});
