## Why

This work was classified as OpenSpec-required because it changes observable managed-install behavior, package distribution, architecture boundaries, and product-facing documentation. Quantex's published JS CLI currently depends on Bun runtime APIs, which means users who install through npm or run no-install package-manager entrypoints still need `bun` on `PATH`; that hidden prerequisite raises adoption friction and makes the managed package feel heavier than it should.

## What Changes

- Make the published JS CLI runtime under `src/` and `dist/` execute on supported Node.js without requiring Bun runtime APIs or a `bun` shebang.
- Keep Bun as a maintainer-facing development, build, validation, and release tool for the repository instead of making the whole project Node-first.
- Add regression checks that verify the packed managed-install artifact still excludes standalone binaries and that the built CLI can be executed by Node.
- Update product-facing install and no-install documentation so users understand the runtime expectations for npm, Bun, and standalone binary usage.

## Capabilities

### New Capabilities

- `js-runtime-compatibility`: the managed-install JS CLI runtime executes under supported Node.js without requiring Bun to be present at runtime.

### Modified Capabilities

- `package-distribution`: the managed-install package keeps the runtime files and metadata needed for Node-based execution while still excluding standalone binary artifacts.
- `product-readme`: install and no-install guidance describe the managed package's Node runtime contract and keep standalone binaries as the no-runtime path.

## Impact

- Affected code: `src/cli.ts`, `src/config/`, `src/state/`, `src/self/`, `src/utils/`, `src/package-manager/bun.ts`, and packaging validation scripts.
- Affected contracts: published CLI runtime compatibility, managed package contents, and user-facing installation guidance.
- Dependencies and tooling: Node-compatible runtime helpers may replace Bun-only runtime APIs; Bun remains the repo's primary maintainer toolchain.
