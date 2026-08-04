# Quantex Desktop

Quantex Desktop is the macOS native surface for checking and confirming
updates to agents managed by Quantex. It keeps lifecycle state and provider
decisions inside the bundled CLI; the app itself owns only UI, preferences,
tray behavior, notification de-duplication, and scheduling.

## Local development

For fast UI work in a browser, run:

```bash
bun run desktop:dev:web
```

This starts Vite with deterministic interactive mock data. It does not invoke
Tauri, read local Quantex state, or run updates.

To exercise the native host and real bundled CLI bridge, run:

```bash
bun run desktop:dev
```

The command builds the matching arm64 and x64 Quantex sidecars into
`src-tauri/resources/bin/` before starting Tauri. Those binaries are generated
resources and are intentionally ignored by git.

Useful checks:

```bash
bun run desktop:typecheck
bun run desktop:test
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
bun run desktop:build
bun run desktop:build:x64
```

The current build is an unsigned local macOS bundle. App signing, notarization,
and distribution are deliberately deferred until Apple Developer credentials
are available.
