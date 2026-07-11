# Task 8 Brief: Derive Capabilities And Update Buckets

## Objective

Create the single compile-time first-party adapter registry and derive legacy installer capabilities plus update bucket ordering from registered operations. Preserve all public capability results and update presentation order.

## Boundary

- No dynamic provider registration or loading.
- `getInstallerCapabilities` and related compatibility helpers retain their names and semantics.
- A provider is managed only when its registered adapter implements update and uninstall.
- npm/Bun latest-version lookup remains derived from `resolveLatestVersion`.
- Planning and service update buckets consume the same derived managed-provider order.
- Do not touch catalog candidate schema or entries.

## Completion

- Add failing first-party registry/capability/order tests first.
- Remove the duplicated capability table and both hard-coded update enumerations.
- Run focused planning/service/provider tests and full gates.
- Mark only OpenSpec `4.8`, report, and checkpoint commit.
