# Quantex Desktop

Quantex Desktop is the macOS native surface for browsing supported agents,
inspecting their state, installing, ensuring, updating, uninstalling, opening
them in the system terminal, reviewing diagnostics, and editing Quantex
configuration. It also checks managed updates in the background and requires
confirmation before applying them.

Lifecycle state, configuration, provider decisions, and mutations stay inside
the bundled CLI. The app itself owns only UI, Desktop preferences, tray
behavior, notification de-duplication, and scheduling. Its layout is based on
the official shadcn `dashboard-01` block and composes unmodified generated UI
primitives with the default theme.
Desktop appearance can follow macOS automatically or remain fixed to the
default shadcn light or dark mode.

## Local development

For fast UI work in a browser, run:

```bash
bun run desktop:dev:web
```

This starts Vite with deterministic interactive mock data for the complete
feature surface. It does not invoke Tauri, read local Quantex state, or run
lifecycle mutations.

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
