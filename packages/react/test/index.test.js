import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

import { defineVooyaComponent } from "../dist/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const greetingDefinition = {
  abiVersion: 1,
  name: "Greeting",
  props: [
    { name: "name", type: "string", required: false, defaultValue: "world" },
    { name: "count", type: "number", required: false, defaultValue: 42 },
    { name: "flag", type: "boolean", required: false, defaultValue: true },
  ],
  events: [],
};

test("mounts omitted props with their declared defaults", async () => {
  const { mountCalls, root } = await renderComponent(greetingDefinition, {});

  assert.deepEqual(mountCalls, [["world", 42, true]]);
  await act(async () => root.unmount());
});

test("passes explicit falsy props through instead of defaults", async () => {
  const { mountCalls, root } = await renderComponent(greetingDefinition, {
    name: "",
    count: 0,
    flag: false,
  });

  assert.deepEqual(mountCalls, [["", 0, false]]);
  await act(async () => root.unmount());
});

test("keeps omitted props without defaults undefined", async () => {
  const definition = {
    abiVersion: 1,
    name: "Required",
    props: [{ name: "label", type: "string", required: true }],
    events: [],
  };
  const { mountCalls, root } = await renderComponent(definition, {});

  assert.deepEqual(mountCalls, [[undefined]]);
  await act(async () => root.unmount());
});

test("re-applies a declared default when a prop is later removed", async () => {
  const { Component, mountCalls, updateCalls, root } = await renderComponent(
    greetingDefinition,
    { name: "Rust" },
  );

  await act(async () => {
    root.render(createElement(Component, {}));
  });

  assert.deepEqual(mountCalls, [["Rust", 42, true]]);
  assert.deepEqual(updateCalls, [{ name: "world" }]);
  await act(async () => root.unmount());
});

async function renderComponent(definition, props) {
  const container = document.createElement("div");
  document.body.append(container);
  const mountCalls = [];
  const updateCalls = [];
  let handle;
  let resolveBindings;

  const Component = defineVooyaComponent(
    definition,
    () =>
      new Promise((resolve) => {
        resolveBindings = resolve;
      }),
  );
  const root = createRoot(container);

  await act(async () => {
    root.render(createElement(Component, props));
  });
  await act(async () => {
    resolveBindings({
      mount(host, ...values) {
        mountCalls.push(values);
        handle = {
          dispose() {},
          ...Object.fromEntries(
            definition.props.map((prop) => [
              `update_${prop.name}`,
              (value) => updateCalls.push({ [prop.name]: value }),
            ]),
          ),
        };
        return handle;
      },
    });
  });

  return { Component, mountCalls, updateCalls, root };
}
