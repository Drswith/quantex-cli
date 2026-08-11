## Context

The repository intentionally standardizes contributor and CI workflows on Bun 1.3.11, and Bun uniquely compiles the standalone release binaries. Bun is also a legitimate first-party provider executable and a persisted self-install source. These are separate responsibilities from the runtime contract of the published JavaScript CLI, whose entry point and build target are Node 20.

`src/utils/child-process.ts` currently collapses those identities by detecting `globalThis.Bun.spawn` and selecting it for eligible child processes. Vitest then creates a fake process-wide Bun object so package-manager and self-upgrade tests can replace that global. The read-only smoke preload also assumes application subprocesses flow through `Bun.spawn`.

The public CLI, provider command shapes, cancellation behavior, structured output, state, and release formats must remain unchanged. The implementation must continue to work in the Node-targeted npm package and in Bun-compiled standalone binaries on macOS, Linux, and Windows.

## Goals / Non-Goals

**Goals:**

- Make application subprocess execution independent of the in-process Bun global.
- Keep Bun's toolchain, compiler, external provider, and self-install-source roles explicit and intact.
- Use one existing process implementation across Node and compiled Bun artifacts.
- Make tests replace the process boundary rather than mutating a runtime global.
- Preserve the read-only smoke guard across both application and repository-script process APIs.
- Prevent the runtime-global coupling from returning silently.

**Non-Goals:**

- Removing Bun as the repository package manager or task runner.
- Removing Bun-managed agent installation or Bun-managed Quantex self-upgrade.
- Rewriting every Bun-native repository script to Node APIs.
- Renaming public configuration fields, provider IDs, state identities, commands, or structured output.
- Changing release workflows, artifact formats, or supported platforms.

## Decisions

### Use `cross-spawn` as the single application child-process launcher

`spawnCommand` will always delegate ordinary child creation to the existing `cross-spawn` dependency after resolving the executable path required by detached POSIX process groups. The returned Node-compatible child handle remains adapted to the existing `SpawnedProcessHandle` contract.

This removes runtime selection from application code and preserves Windows command-shim handling without a second code path. Direct `node:child_process` use remains appropriate for the bounded Windows `taskkill.exe` cleanup helper.

Alternatives considered:

- Keep the Bun fast path behind a dedicated adapter. Rejected because the JavaScript distribution does not need it and tests would still need a Bun-specific implementation seam.
- Inject a launcher through every package-manager function. Rejected for this change because `spawnCommand` is already the shared process boundary; broad per-function dependency plumbing would add more architecture than it removes.
- Use only `node:child_process.spawn`. Rejected because `cross-spawn` is already a runtime dependency and retains the repository's tested Windows shim normalization.

### Keep Bun provider operations external

Provider and self-upgrade modules retain `bun` as a provider/source identity and continue constructing `bun add`, `bun update`, `bun remove`, and `bun pm` commands. They do not import or call Bun runtime APIs; commands execute through the same runtime-neutral process boundary as every other provider.

Alternative considered: merge the Bun provider with repository toolchain configuration. Rejected because a user's available installer and recorded self-install source are product facts independent of the contributor toolchain.

### Remove the Vitest-wide Bun shim

Tests that exercise process creation will mock `cross-spawn` or inject an existing `ProcessPort`. Tests that need filesystem writes use `node:fs`. Explicit fixture programs may still use Bun APIs when the fixture intentionally verifies Bun process behavior.

Alternative considered: retain a reduced fake Bun global for compatibility. Rejected because it hides accidental application coupling and lets unrelated tests pass for the wrong runtime reason.

### Guard both process families in read-only smoke runs

The Bun preload will continue wrapping `Bun.spawn` and `Bun.spawnSync` for Bun-native repository scripts. It will additionally wrap the mutable `node:child_process` default export before application modules load, so `cross-spawn` calls are checked by the same allowlist and recorded in the same guard log. On Windows, the guard will conservatively unwrap the exact `cmd.exe /d /s /c` encoding produced by `cross-spawn` for command shims before classifying and recording the logical provider command; unsupported shell forms remain blocked.

Alternative considered: move the guard into `src/**`. Rejected because the guard is smoke infrastructure, not a user-facing application policy, and should not ship as product behavior.

### Enforce the boundary structurally

An architecture test will parse TypeScript under `src/**` and fail if application source references the in-process `Bun` global. Strings and data identities such as provider ID `bun` remain allowed. The ADR will describe which Bun responsibilities are retained and why.

## Risks / Trade-offs

- [Cross-platform process semantics drift] → Retain existing process-handle, stdio, detached-path, cancellation, and Windows shim tests; run the full three-platform CI matrix and standalone build checks.
- [Read-only smoke guard misses Node-compatible launches] → Patch `node:child_process` before importing the CLI and add end-to-end preload tests for both Bun-native and cross-spawn launch paths.
- [Test mocks become platform-sensitive] → Standardize package-manager tests on the existing cross-spawn mock helper and remove conditional Bun-global mutation.
- [Compiled binaries expose a cross-spawn incompatibility] → Run `build:bin`, release artifact generation, release smoke, and package verification before delivery.
- [Scope expands into toolchain replacement] → Keep direct Bun APIs allowed under `scripts/**`; only application source receives the runtime-neutral restriction.

## Migration Plan

1. Add the runtime-boundary spec, ADR, and architecture regression test.
2. Replace the dual Bun/Node branch in `spawnCommand` with the single cross-spawn path.
3. Extend the read-only preload to cover Node-compatible spawn and update its tests.
4. Remove the global test shim and migrate affected unit tests to explicit process mocks.
5. Run targeted process/provider/self-upgrade tests, then all repository, build, release-artifact, and package checks.

Rollback is a normal source revert: no state, config, package, or schema migration is introduced.

## Open Questions

None. Replacing generic Bun APIs inside repository-only scripts can be evaluated separately if it produces measurable maintenance value.
