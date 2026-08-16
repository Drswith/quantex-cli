## Context

The lifecycle smoke currently installs a selected real agent and immediately calls `qtx update`. For a package-provider agent, the freshly installed package is already at the registry's latest version, so `decideUpdate` returns `up-to-date` and `src/services/lifecycle-updates.ts` never persists the receipt produced after a managed update. PR #632 exposed that the install writers and update writer intentionally persist different executable-name shapes, while uninstall must accept both shapes.

The validation must stay inside Quantex's lifecycle scope, remain disposable in CI, and avoid making the canary depend on a hard-coded historical package version that may disappear from a registry.

## Goals / Non-Goals

**Goals:**

- Make the real-agent canary reach a managed-provider `upgrade` outcome and persist the update receipt before uninstall.
- Make a deterministic unit/contract test cover the actual legacy install, Core install, and update receipt construction paths for every first-party provider type.
- Keep the existing fallback-aware reader as the compatibility boundary; the change must detect regressions rather than normalize persisted shapes.

**Non-Goals:**

- Do not change receipt writers to emit a uniform executable-name field.
- Do not change `conflicting-source`, `UNINSTALL_FAILED`, or any CLI schema/error contract.
- Do not widen the legacy/Core differential gate to update or uninstall.
- Do not add a new external dependency or a new root-level workflow wrapper.

## Decisions

### Use `opencode` as the real-upgrade canary anchor

The quick matrix already includes `opencode`, its Linux Bun candidate is the selected provider, and its package declares an installed-version probe. The smoke path therefore runs on pull requests as well as full scheduled/manual canaries. The scenario is guarded by both the agent name and selected provider so it cannot silently claim coverage for a different source.

### Resolve the seed version from npm metadata at runtime

The smoke fetches the package metadata from the official npm registry, selects the highest valid stable SemVer lower than the current `latest`, and installs that exact version with Bun. This avoids pinning a version that upstream may remove while still guaranteeing that the following update has a lower installed version. A missing/invalid predecessor is a canary failure, not a skip.

### Keep the provider registry path real

The seed is installed through the same Bun global environment used by the canary, then `qtx install opencode` adopts the existing package. The smoke runs `qtx update --refresh`, asserts the result is `updated`, reads the state receipt, and invokes `qtx uninstall`. It does not mock provider commands or replace the registry with a local fake, so reverting the uninstall fallback makes the canary fail at the actual user-facing boundary.

### Test each production writer through its existing composition

The contract test captures a receipt from `reconcileAgentInstallation` for the legacy install path, from `createProductionCoreInstallationPorts().prepareRecord` for the Core install path, and from `executeSingleAgentLifecycleUpdate` for the update path. For each provider in `firstPartyProviderIds`, it resolves the installed-state and receipt bindings and asserts the uninstall comparator accepts them with the agent's declared default executable name. The test also checks persisted-binding reconstruction so the same evidence remains usable by lifecycle observation/update readers.

### Keep provider fixtures explicit

The test matrix supplies provider-appropriate target kinds, package arguments, commands, and executable names. It does not derive the expected result from the reader itself; each writer's persisted receipt is captured first, then fed into the reader. This keeps a removed fallback or a writer drift observable.

## Risks / Trade-offs

- [Risk] The selected package may have no valid older stable release or the registry may be unavailable. → Fail the advisory canary with the package and registry reason; do not convert missing upgrade evidence into a passing no-op.
- [Risk] Directly seeding a global package could leave an artifact if the later Quantex operation fails. → Run inside the disposable canary HOME/`BUN_INSTALL` and retain the existing in-flight cleanup stack; the hosted runner is destroyed after the job.
- [Risk] A provider-specific receipt shape can be added later without the test matrix being updated. → Drive the matrix from `firstPartyProviderIds` and assert that every provider has an explicit fixture.
- [Risk] The contract test can become coupled to unrelated provider mutation behavior. → Capture receipts at the writer boundaries with injected observation/mutation ports; do not execute real external provider commands in the unit suite.

## Migration Plan

No persisted-data migration is required. Land the smoke and contract test with the OpenSpec delta, run the local validation suite, then rely on the advisory canary to exercise the real upgrade. Rollback is a source revert; existing receipts remain readable because the runtime uninstall behavior is unchanged.

## Open Questions

None for this change. A broader update/uninstall legacy/Core differential gate remains a separate follow-up as stated by issue #633.
