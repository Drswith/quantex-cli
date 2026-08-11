## Why

Quantex currently uses the name and APIs of Bun across repository tooling, standalone compilation, in-process child execution, agent package management, and self-upgrade. Those responsibilities are individually valid, but allowing the published application runtime and Vitest setup to depend on a mutable `globalThis.Bun` makes the Node 20 distribution boundary unclear and couples provider tests to the repository toolchain.

## What Changes

- Define an explicit runtime boundary: Bun remains the pinned repository package manager and task runner, the standalone binary compiler, an external agent provider, and a self-install source.
- Make application child-process execution runtime-neutral by routing it through the existing Node-compatible `cross-spawn` dependency instead of selecting `globalThis.Bun.spawn` at runtime.
- Keep Bun provider operations external: install, update, uninstall, observation, and self-upgrade continue invoking the `bun` executable through the shared process boundary.
- Remove the Vitest-wide fake Bun global and update tests to mock the process boundary directly.
- Extend the read-only smoke preload so it guards both Bun-native subprocess calls used by repository scripts and Node-compatible subprocess calls used by application code.
- Record the long-lived boundary in an ADR and add architecture assertions that prevent in-process Bun globals from returning to application source.
- Preserve all public commands, options, JSON/NDJSON/schema fields, exit semantics, configuration fields, state identities, provider behavior, package entry points, and release artifact formats.

## Capabilities

### New Capabilities

- `runtime-boundaries`: Defines the separation between the Bun repository toolchain, runtime-neutral application code, external Bun provider operations, and Node/standalone distribution targets.

### Modified Capabilities

- None.

## Impact

- `src/utils/child-process.ts` and its callers continue using the same internal `spawnCommand` contract, but the implementation no longer probes or adapts `globalThis.Bun`.
- Package-manager, version-probe, detection, self-binary, and process tests move from Bun-global mutation to explicit `cross-spawn` or runtime-port mocks.
- `scripts/lib/read-only-spawn-guard.ts` and its smoke coverage guard both supported subprocess implementations.
- `test/setup.ts` returns to CLI-context cleanup only; explicit Bun fixture programs remain allowed where a test intentionally exercises Bun behavior.
- `docs/adr/0010-separate-bun-toolchain-from-product-runtime.md` records the durable decision.
- No dependency, public API, config, state, release workflow, or package-format migration is introduced.

## Intake classification

Architecture-boundary and durable runtime-contract change: OpenSpec required before implementation.
