## Why

`quantex-core@0.0.0` now reserves the final public npm identity and its npm trusted publisher has been configured. The SDK needs its own minimal, recoverable publication path so a Core failure cannot delay or alter the CLI package, GitHub Release, or binary artifacts.

## What Changes

- Activate the public package identity `quantex-core` and make `0.1.0` the first supported SDK release after the `0.0.0` bootstrap.
- Replace the provisional `@quantex/core` package identity in repository source, package checks, and product documentation.
- Add a manually dispatched, Core-only `release-core.yml` with npm OIDC publishing, exact-version verification, and immutable `core-v<version>` recovery tags.
- Keep `release.yml`, CLI release-please, GitHub Releases, and standalone binary publication independent and unchanged.
- **BREAKING**: downstream SDK consumers must change imports from the unpublished provisional `@quantex/core` identity to `quantex-core`.

## Capabilities

### New Capabilities

- `core-npm-release`: Defines independent, OIDC-backed, recoverable publication of the public Core SDK.

### Modified Capabilities

- `package-distribution`: Activates the Core package's public identity and decouples its version from the root CLI version.
- `product-readme`: Replaces provisional SDK installation and import guidance with the public package contract.

## Impact

- `packages/core/package.json`, root dependency metadata, TypeScript paths, Core package checks, and package-consumer fixtures.
- New `.github/workflows/release-core.yml`, release runbook, and Core publication tests.
- Existing CLI release automation remains untouched; no CLI release is created by this change.
