# Task 3 Brief: Migrate npm And Bun Adapters

## Objective

Implement typed npm and Bun provider adapters, run both through the reusable conformance harness, and route the maintained `ManagedInstaller` npm/Bun entries through a boolean compatibility projection without changing current CLI or root-export behavior.

## Architecture

- Add a shared internal registry-package adapter factory only where npm/Bun behavior is genuinely identical; keep provider-specific command construction/default dependencies in separate `src/providers/adapters/npm.ts` and `bun.ts` modules.
- Dependencies are injectable for deterministic conformance tests. Default dependencies call the existing `src/package-manager/npm.ts`, `bun.ts`, `utils/detect`, and npm-registry version resolver through namespace/property access so existing Vitest spies remain effective.
- Typed operations preflight an aborted signal and distinguish cancellation/timeout/failure. A timeout race may stop waiting on a legacy boolean dependency, but this milestone must not claim process-tree cancellation or route a new timeout into existing CLI behavior.
- Provider requests carry typed npm/Bun options for update strategy, dist tag, and registry. Do not encode these options in untyped metadata.
- Observation maps `present`, `absent`, and `unknown` into typed present/absent/indeterminate outcomes and preserves provider/version evidence. Verification derives satisfied/unsatisfied/indeterminate from a fresh observation.
- Mutation success/failure carries exact command/provider evidence; false legacy results become typed failures without fabricating an exit code.
- `ManagedInstaller` remains a maintained compatibility type/root export. Its npm/Bun entries project typed outcomes back to existing booleans and preserve direct installed-version/presence probes so current call counts and meanings do not drift.
- Do not migrate the other seven managed providers, remove the capability table, normalize catalog data, or route command handlers directly to typed outcomes in this task.

## Required tests

1. Add failing `test/providers/npm.test.ts` and `bun.test.ts` before adapter modules exist.
2. Invoke `describeProviderConformance` for each real adapter factory with injected deterministic dependencies. The reusable unsupported case may be omitted for a full-capability adapter because production target/batch unsupported mapping is already tested centrally.
3. Prove npm/Bun install, update, update-many, uninstall, observation, latest-version resolution, and verification preserve provider identity/evidence.
4. Prove `latest-major` and `respect-semver`, dist tag, and normalized registry inputs reach the existing provider-specific dependencies unchanged.
5. Prove a never-settling dependency returns the exact requested timeout and an already-aborted signal never invokes the dependency.
6. Run existing npm/Bun low-level tests to preserve npm argv, registry normalization, Bun trust/rollback, Windows scoped-package parsing, presence, and version parsing.
7. Run existing package-manager/index and update tests to prove the compatibility facade remains boolean and strategy-aware.

## Completion

- Update OpenSpec `4.3` only after both default adapters are wired through the compatibility facade, both conformance suites pass, all focused legacy tests pass, and independent review has no blocker/important finding.
- Write `task-3-report.md`, update progress, and create checkpoint `refactor(providers): migrate npm and bun adapters`.
