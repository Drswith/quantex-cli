## Why

After the lifecycle redesign, cargo, deno, pip, and winget provider adapters still hardcode `probePackagePresence` to `unknown`. Install verification and uninstall reconciliation require conclusive provider observation, so successful installs through these providers fail closed and roll back working packages, while tracked installs cannot be uninstalled. Catalog agents such as deno-only `genie`, Windows winget `copilot`, cargo `vtcode`, and pip fallback `vibe` hit this path today.

## What Changes

- Add cargo, deno, pip, and winget package presence probing with `present`, `absent`, and `unknown` outcomes.
- Wire those probes (and installed-version helpers where available) into the provider adapters and managed-installer compatibility projections.
- Ensure deno provider bindings carry the executable binary name needed for global-install observation.
- Add regression tests for confirmed absence, still-present, and inconclusive probe paths.
- Extend uninstall and ghost-recovery contract coverage to these providers.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: ghost uninstall recovery must confirm cargo/deno/pip/winget package absence before clearing state and must fail closed when presence probing is inconclusive.
- `agent-uninstall`: uninstall reconciliation must use conclusive cargo/deno/pip/winget provider presence when available rather than treating observation as permanently indeterminate.

## Impact

- Affected code: `src/package-manager/{cargo,deno,pip,winget}.ts`, `src/providers/adapters/{cargo,deno,pip,winget}.ts`, `src/package-manager/installers.ts`, `src/lifecycle/provider-evidence.ts`, related tests.
- No CLI flags, schema version, or command catalog changes.
- Work-intake classification: observable lifecycle behavior and provider presence probing require OpenSpec.
