import assert from "node:assert/strict";
import test from "node:test";

import { formatVooComponent as compilerFormatter } from "@vooya/compiler";
import { formatVooComponent } from "../dist/voo-format.js";

test("keeps the public format subpath as a compiler formatter forwarding entry", () => {
  const source = '<component name="Empty"></component>\n<rust>pub struct Component;</rust>';

  assert.equal(formatVooComponent, compilerFormatter);
  assert.equal(formatVooComponent(source, "Empty.voo"), compilerFormatter(source, "Empty.voo"));
});
