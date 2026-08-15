/**
 * Version of the contract shared by the compiler-generated WASM bindings and
 * the framework runtime. The compiler embeds this value in the generated
 * `voo_abi_version()` WASM export; the runtime reads that export before mount
 * and rejects a mismatched value. Increment it only for an incompatible
 * change to generated exports, prop/event marshaling, or lifecycle handles.
 */
export const VOO_ABI_VERSION = 1;
