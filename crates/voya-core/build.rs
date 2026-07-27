use std::{env, fs, path::PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let source = manifest_dir.join("../../target/voya/generated_components.rs");
    let output = PathBuf::from(env::var("OUT_DIR").unwrap()).join("voya_generated.rs");

    println!("cargo:rerun-if-changed={}", source.display());
    if source.exists() {
        fs::copy(source, output).unwrap();
    } else {
        fs::write(output, "// No generated Voya components.\n").unwrap();
    }
}
