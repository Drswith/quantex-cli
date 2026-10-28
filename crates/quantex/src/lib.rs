//! Quantex: an agent lifecycle CLI for humans and agents.

use std::ffi::OsString;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Runs the CLI with the given argv (including the program name) and returns the exit code.
pub fn run(args: Vec<OsString>) -> i32 {
    let rest: Vec<String> = args
        .iter()
        .skip(1)
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect();
    if matches!(rest.as_slice(), [flag] if flag == "--version" || flag == "-V") {
        println!("{VERSION}");
        return 0;
    }
    eprintln!("quantex {VERSION}: not implemented yet");
    1
}
