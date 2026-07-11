# Task 6 Brief: Migrate pip, uv, And mise Adapters

## Objective

Migrate pip, uv, and mise to typed adapters while preserving provider-specific command shapes, uv install arguments, and uv/mise presence and installed-version behavior. Route all three maintained `ManagedInstaller` entries through typed compatibility projections.

## Boundary

- Extend the shared system-package adapter only with optional installed-version observation and explicit operation diagnostics.
- pip keeps its existing command resolution and has no fabricated presence/version probe.
- uv keeps `tool install`, `tool upgrade`, package arguments, and parsed tool-list presence/version behavior.
- mise keeps global use/unuse, forced update, and parsed installed-tool presence/version behavior.
- Do not touch script/binary providers, derived capabilities, catalog, commands, or state.

## Completion

- Add failing provider and compatibility tests first.
- Run conformance, existing low-level tests, package-manager/update compatibility, and full gates.
- Mark only OpenSpec `4.6`, keep `4.2` unchecked, report, and checkpoint commit.
