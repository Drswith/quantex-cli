## 1. Compatibility Baseline

- [x] 1.1 Capture v0.29-compatible golden fixtures for representative human, JSON, and NDJSON results across every stable command family.
- [x] 1.2 Add contract tests that prove every registered stable command appears exactly once in command discovery and has a resolvable schema reference.
- [x] 1.3 Add failing planner tests for stale lower targets, semantic prerelease ordering, unknown versions, and explicit no-downgrade behavior.
- [x] 1.4 Add failing tests that prove ordinary command finalization cannot perform a self-update network request and cached notices remain cache-only.
- [x] 1.5 Capture valid, corrupt, ghost, and untracked v1 state fixtures plus the maintained root-package export surface.
- [x] 1.6 Document which fixtures are hard compatibility contracts and which human-output details are intentionally non-contractual.

## 2. Invocation and Domain Foundation

- [x] 2.1 Introduce per-invocation runtime context ports for clock, cancellation, timeout, process, filesystem, network, locks, cache, and persistence.
- [x] 2.2 Define typed lifecycle intent, observation, drift, plan, step, postcondition, verification, receipt, and outcome models without CLI dependencies.
- [x] 2.3 Implement pure plan validation for ordered steps, declared effects, required provider capabilities, postconditions, and compensation metadata.
- [x] 2.4 Replace internal boolean operation results with typed outcomes while preserving v1 error and exit mapping at the compatibility boundary.
- [x] 2.5 Add unit tests proving concurrent in-process invocations cannot share cancellation, cache, dry-run, quiet, or output state.

## 3. Command Contract Registry

- [x] 3.1 Define the authoritative command-contract registry with names, aliases, arguments, options, effects, result/event schemas, presenters, and handlers.
- [x] 3.2 Generate Commander registration and global-option handling from the registry while preserving current accepted command lines.
- [x] 3.3 Generate `commands --json` from the registry and remove the independent command catalog.
- [x] 3.4 Generate `schema --json` from the registry, add the six currently missing stable command schemas, and preserve existing v1 schema shapes.
- [x] 3.5 Replace shortcut global-option parsing duplication with registry-driven normalization while preserving transparent shortcut execution.
- [x] 3.6 Add registry validation for duplicate names/aliases, unresolved handlers, inconsistent options, missing schemas, and effect mismatches.
- [x] 3.7 Route human, JSON v1, and NDJSON v1 output through explicit presenters over one canonical result/event model.

## 4. Provider and Catalog Contracts

- [x] 4.1 Define the compile-time provider adapter registry with typed availability, observation, install, update, uninstall, and verification operations.
- [x] 4.2 Add a reusable provider conformance suite for unsupported operations, typed failures, cancellation, timeout, presence, and verification evidence.
- [x] 4.3 Migrate npm and Bun adapters to the typed contract and preserve registry/update-strategy behavior.
- [x] 4.4 Migrate Homebrew and winget adapters to the typed contract and preserve formula, cask, and package-id semantics.
- [x] 4.5 Migrate Cargo and Deno adapters to the typed contract and preserve package arguments and executable-name semantics.
- [x] 4.6 Migrate pip, uv, and mise adapters to the typed contract and preserve provider-specific presence/version behavior.
- [x] 4.7 Represent script and standalone-binary candidates with explicit executable or shell-script effects without adding dynamic provider loading.
- [x] 4.8 Replace duplicated provider capability tables and hard-coded update bucket enumerations with capabilities derived from registered adapters.
- [x] 4.9 Update the agent catalog schema so each candidate binds provider and provider-specific target identity once.
- [x] 4.10 Migrate npm, Bun, and mise-backed catalog entries to provider-bound candidates and declarative probes.
- [x] 4.11 Migrate Cargo, Deno, pip, and uv-backed catalog entries to provider-bound candidates and declarative probes.
- [x] 4.12 Migrate Homebrew and winget-backed catalog entries to provider-bound candidates and declarative probes.
- [x] 4.13 Migrate script and standalone-binary catalog entries without changing agent identity or platform coverage.
- [x] 4.14 Generate catalog support documentation and validation inputs from the normalized catalog model.

## 5. Observation and Read-Only Migration

- [x] 5.1 Implement live observation that combines executable, provider, version, receipt, and capability evidence into explicit consistency/drift classifications.
- [x] 5.2 Implement pure lifecycle planning for already-satisfied, absent, tracked, untracked, ghost, conflicting, unsupported, and indeterminate observations.
- [x] 5.3 Migrate `list` and `info` to the new catalog/application boundary and verify v1 compatibility fixtures.
- [x] 5.4 Migrate `inspect` and `resolve` to live observations and preserve install guidance and structured fields.
- [x] 5.5 Migrate `capabilities` to registry-derived provider and command capabilities without adding fields to strict v1 projections.
- [x] 5.6 Migrate `doctor` to observation-based diagnostics while keeping explicitly declared network checks and remediation semantics.
- [x] 5.7 Run read-only commands against real local and container environments and compare results with the compatibility baseline.

## 6. Versioned State and Core Mutations

- [x] 6.1 Add schema-versioned lifecycle receipts while retaining the legacy `installedAgents` and `self` projection.
- [x] 6.2 Implement atomic legacy-state migration, validated backup retention, rollback, and fail-closed read/write behavior.
- [x] 6.3 Add fault-injection tests for interrupted migration, invalid schema, backup restore, older-version projection rewrite, and receipt rebuilding.
- [x] 6.4 Add shadow planning for current mutation handlers and report plan mismatches in tests without changing default execution.
- [x] 6.5 Migrate `ensure` to reconciliation and require verified installation/adoption postconditions before writing a receipt.
- [x] 6.6 Migrate single and multi-agent `install` to planned execution, typed partial results, compensation, and verified receipts.
- [x] 6.7 Migrate `uninstall` to receipt/provider/PATH reconciliation with distinct unmanaged, ghost, provider-failure, and verification-failure outcomes.
- [x] 6.8 Verify migrated mutations preserve locks, cancellation, timeout, dry-run, non-interactive, and source-aware behavior.

## 7. Update and Idempotency Migration

- [x] 7.1 Implement normalized semantic version comparison, prerelease ordering, indeterminate-version handling, and explicit no-downgrade planning.
- [x] 7.2 Migrate single-agent update to source-aware provider plans and verified live postconditions.
- [x] 7.3 Migrate `update --all` to deterministic target-plan composition with typed partial success and cancellation semantics.
- [x] 7.4 Add schema-versioned idempotency records with canonical request, resolved-plan, receipt, postcondition, and expiry fingerprints.
- [x] 7.5 Implement command-specific replay validators and stable request-mismatch handling without overwriting existing records.
- [x] 7.6 Add idempotency tests for target-option changes, reordered equivalent inputs, latest-target changes, batch targets, drift, dry run, failure, and expiry.

## 8. Agent Execution Migration

- [x] 8.1 Migrate explicit `exec` preflight and install policies to the new observer/planner/application boundary.
- [x] 8.2 Migrate shortcut launch to the same execution use case without duplicating lifecycle or option parsing.
- [x] 8.3 Preserve inherited stdin/stdout/stderr, child exit codes, interaction guidance, timeout, and process-tree cancellation.
- [x] 8.4 Run execution and managed-installer cancellation tests on Unix and Windows-capable CI/sandbox paths.

## 9. Self-Upgrade Integration

- [x] 9.1 Adapt self-upgrade to shared invocation, process, network, lock, cache, persistence, result, and presentation ports without importing agent lifecycle domain types.
- [x] 9.2 Make passive self-update notices consume valid cached metadata only and keep fresh checks limited to explicitly declared commands.
- [x] 9.3 Preserve Bun/npm registry resolution, managed-install verification, binary checksum, replacement, rollback, and recovery behavior.
- [x] 9.4 Preserve Windows peer entry point and delayed replacement semantics with fault-injection coverage.
- [x] 9.5 Run build, binary, release artifact, and release smoke verification for the migrated self-upgrade path.

## 10. Compatibility Facade and Legacy Removal

- [x] 10.1 Route all maintained root-package exports through a compatibility facade and add downstream compilation/runtime fixtures.
- [x] 10.2 Verify the `quantex` alias package and both `qtx`/`quantex` binaries continue to expose equivalent entry points.
- [x] 10.3 Run the complete v1 protocol, stream, exit-code, config, state, and root-export compatibility suite against the new default routes.
- [x] 10.4 Update product documentation and generated command/catalog references only after the new default behavior is verified.
- [x] 10.5 Remove legacy command-specific lifecycle implementations only after every default route uses the new engine and rollback criteria are satisfied.
- [x] 10.6 Keep any future root-export removal outside this change and require a separately approved deprecation proposal.

## 11. Validation and Delivery Closure

- [x] 11.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck` after every implementation milestone.
- [x] 11.2 Run `bun run test` plus relevant container/sandbox suites after every migrated command family.
- [x] 11.3 Run `bun run openspec:validate` and `bun run memory:check` after spec, ADR, or product-documentation changes.
- [x] 11.4 Run `bun run build`, `bun run build:bin`, `bun run package:check`, and `bun run release:artifacts` before the final implementation PR is declared ready.
- [x] 11.5 Validate every PR body through `bun run pr:body:check` and report implementation, repository, PR, merge, release, and archive closure separately.
- [x] 11.6 Before final promotion, verify all implementation PRs are merged and record a ready-to-run post-promotion follow-up for current-spec synchronization and OpenSpec archive closure; completing this readiness task earns its existing implementation credit, while actual spec synchronization and archive execution occur only after `codex/redesign-lifecycle-integration` merges to `main`.
