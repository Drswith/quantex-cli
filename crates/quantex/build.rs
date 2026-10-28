//! Embeds every `contract/catalog/*.json` agent definition, so adding an agent is a
//! data-only change.

use std::fmt::Write as _;
use std::path::PathBuf;

fn main() {
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let catalog = manifest.join("../../contract/catalog");
    println!("cargo:rerun-if-changed={}", catalog.display());

    let mut files: Vec<PathBuf> = std::fs::read_dir(&catalog)
        .expect("contract/catalog exists")
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "json"))
        .collect();
    files.sort();

    let mut source = String::from("pub static CATALOG_FILES: &[&str] = &[\n");
    for path in &files {
        println!("cargo:rerun-if-changed={}", path.display());
        let absolute = path.canonicalize().unwrap();
        writeln!(source, "    include_str!({:?}),", absolute.to_string_lossy()).unwrap();
    }
    source.push_str("];\n");

    let out = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("catalog_files.rs");
    std::fs::write(out, source).unwrap();
}
