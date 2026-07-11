# Task 4 Brief: Migrate Homebrew And winget Adapters

## Objective

Implement typed Homebrew and winget adapters, preserve formula/cask/package-ID semantics, run both through the shared conformance harness, and route their maintained `ManagedInstaller` entries through typed-to-boolean compatibility projections.

## Boundary

- Reuse the existing cancellation/timeout/typed-failure machinery through a narrow shared legacy-operation helper; do not duplicate another promise race.
- Homebrew targets normalize to `formula` unless explicitly `cask`; winget targets normalize to `id`.
- Preserve exact command forms: `brew <action> [--cask] <name>` and `winget <action> --id <id> -e`.
- Existing low-level boolean modules remain unchanged and are default adapter dependencies accessed through module namespaces so spies remain effective.
- Package presence is injectable for conformance. Until a later observation implementation supplies a real probe, default Homebrew/winget observation is typed `indeterminate`, not fabricated absence or presence.
- Do not migrate Cargo/Deno, capabilities, update buckets, catalog data, state, or command handlers.

## Completion

- Start with failing provider tests for missing adapter modules.
- Verify formula/cask/id commands, batch identity, typed outcomes, cancellation, timeout, and boolean compatibility routing.
- Run focused legacy/update tests and the full repository gates.
- Mark OpenSpec `4.4` only after both adapters and facade entries pass; keep `4.2` unchecked.
- Write the report and checkpoint `refactor(providers): migrate brew and winget adapters`.
