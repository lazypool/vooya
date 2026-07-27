//! Runtime primitives and generated bindings for Voya components.

mod reactive;
mod view;

pub use reactive::{Effect, Signal, effect, signal};
pub use view::{EventListener, View, ViewElement};

include!(concat!(env!("OUT_DIR"), "/voya_generated.rs"));
