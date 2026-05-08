## Why

The post-merge `Sandbox Tests` workflow still fails in the full `self-managed` scenario even after the PR gate was narrowed. The failure is not in Modal transport; it is in the sandbox harness itself.

The current self-managed smoke setup returns a minimal local-registry packument and installs Quantex into an ad hoc `bun-global` root. Bun accepts that install, but it does not generate the `qtx` shim or link runtime dependencies because the mocked registry metadata omits fields Bun needs for a real global install. The custom install root also diverges from Quantex's real Bun-install detection rules.

## What Changes

- Make the sandbox-local registry expose version entries derived from the staged package manifests instead of only `name`, `version`, and tarball URLs.
- Run the self-managed smoke scenario inside an isolated `HOME` with a real `.bun` layout so Bun-managed self-install detection matches production behavior.
- Add unit coverage for the richer registry metadata used by the self-managed sandbox harness.

## Impact

- The post-merge full sandbox workflow regains stable `self-managed` coverage.
- Self-managed smoke better reflects how published Bun installs behave in production.
- The merge-gating PR sandbox profile remains unchanged; this only stabilizes the protected-branch full profile.
