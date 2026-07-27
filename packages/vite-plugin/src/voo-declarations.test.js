import assert from "node:assert/strict";
import test from "node:test";

import { generateVooDeclaration } from "./voo-declarations.js";

test("generates Vue props and event declarations from a component contract", () => {
  const declaration = generateVooDeclaration(
    {
      name: "Counter",
      props: [
        { name: "initial", rustType: "i32", required: true },
        { name: "label", rustType: "String", required: false },
      ],
      events: [
        { name: "change", parameters: [{ name: "value", rustType: "i32" }] },
        { name: "reset-all", parameters: [] },
      ],
    },
    "vue",
  );

  assert.match(declaration, /initial: number;/);
  assert.match(declaration, /label\?: string;/);
  assert.match(declaration, /change: \(value: number\) => void;/);
  assert.match(declaration, /"reset-all": \(\) => void;/);
  assert.match(declaration, /DefineComponent</);
});

test("generates React callback props from component events", () => {
  const declaration = generateVooDeclaration(
    {
      name: "Counter",
      props: [{ name: "initial", rustType: "i32", required: true }],
      events: [
        { name: "change", parameters: [{ name: "value", rustType: "i32" }] },
        { name: "reset-all", parameters: [] },
      ],
    },
    "react",
  );

  assert.match(declaration, /initial: number;/);
  assert.match(declaration, /onChange\?: \(value: number\) => void;/);
  assert.match(declaration, /onResetAll\?: \(\) => void;/);
  assert.match(declaration, /ComponentType<CounterProps>/);
});
