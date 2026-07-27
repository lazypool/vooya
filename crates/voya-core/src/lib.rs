//! Runtime primitives and generated bindings for Voya components.

mod reactive;

pub use reactive::{Effect, Signal, effect, signal};

include!(concat!(env!("OUT_DIR"), "/voya_generated.rs"));
