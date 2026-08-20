# Writing `.voo` Components

A source component contains a public contract, one Rust implementation, and an
optional style block. `voo-format` emits them in this canonical order:

```text
<component> ... </component>
<rust> ... </rust>
<style scoped> ... </style>
```

## Component contract

The component name must be PascalCase. The contract can contain `props:` and
`events:` sections.

```text
<component name="Counter">
props:
  initial: i32 = 0

events:
  change(value: i32)
</component>

<rust>
// A complete component also defines Component, mount, updates, and dispose.
</rust>
```

A prop without a default is required. A prop with a default is optional in the
generated Vue or React type. For every prop named `value`, the Rust component
must provide `update_value(&self, value: T)`.

The contract-to-TypeScript mapping currently supports these practical types:

| Rust contract type | JavaScript and TypeScript |
| --- | --- |
| `i8`, `i16`, `i32`, `isize` | `number` |
| `u8`, `u16`, `u32`, `usize` | `number` |
| `f32`, `f64` | `number` |
| `bool` | `boolean` |
| `String` | `string` |

The parser recognizes additional numeric and string spellings, but 64-bit and
128-bit integers and borrowed string types do not yet have a stable end-to-end
ABI. Avoid them in public contracts during the alpha.

Events become methods on `context.events`. A one-parameter event becomes a Vue
emit value or a React callback argument. Multi-parameter events preserve their
parameter order.

## Generated Rust context

The compiler creates a typed `Context` alias before the `<rust>` block. It has:

```rust
pub struct Context {
    pub host: web_sys::Element,
    pub props: GeneratedProps,
    pub events: GeneratedEvents,
}
```

Authors implement three lifecycle surfaces:

- `mount(context) -> Result<Component, JsValue>` creates state and owned DOM.
- `update_<prop>(&self, value)` applies host-framework prop changes.
- `dispose(&mut self)` removes owned DOM and releases component resources.

The generated WASM exports wrap these methods. Do not add `#[wasm_bindgen]` to
the component lifecycle methods.

## DOM ownership and cleanup

Use `View::from_host`, `View::element`, and `ViewElement` for common structured
DOM operations. `ViewElement::as_element()` exposes the underlying `web_sys`
element when the small view layer is insufficient.

`ViewElement::on` returns an `EventListener`. Store listeners on `Component` so
they stay alive while mounted; dropping them unregisters the browser callback.
Closures created directly through `web_sys` must likewise remain owned by the
component and be released during disposal.

## Scoped styles

`<style scoped>` is processed through PostCSS. The compiler assigns a stable
`data-voo-scope` attribute to the framework-owned host and prefixes selectors
with that scope. An unscoped `<style>` block is emitted unchanged.

Scoped CSS protects component selectors from the surrounding application. It
does not create Shadow DOM, isolate inherited properties, or replace normal CSS
cascade rules.

Inside a scoped block, `:host` refers to the component's host element:

- Bare `:host` matches the host itself.
- `:host(.active)` matches a host that also carries the `.active` class.
- `:host-context(.dark)` matches a host inside an ancestor with the `.dark`
  class, compiling to `.dark [data-voo-scope="..."]`.

Forms with empty or comma-separated arguments are rejected with a compiler
error that names the selector. During the alpha/beta period these are the only
functional host selectors; `:deep()` and `:global()` are not provided.

## Rust dependencies

Application crates are configured in `vooya({ rust: ... })`, not in a Cargo
manifest beside each component. See the [tooling reference](../reference/tooling.md)
for registry, Git, path, and `web-sys` configuration.

The current compiler combines every source `.voo` component in an application
into one application-local WASM module. Components do not produce independent
WASM files yet.
