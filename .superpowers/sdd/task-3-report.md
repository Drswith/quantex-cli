# Task 3 Report: Migrate npm And Bun Adapters

## Result

OpenSpec `4.3` is complete. npm and Bun now have typed provider adapters with injectable dependencies, typed availability/observation/latest-version/mutation/verification outcomes, exact provider and command evidence, safe failure reasons, pre-aborted cancellation, and bounded timeout results.

The maintained `ManagedInstaller` root-export contract remains boolean. Its npm/Bun entries now call the typed adapters and project success back to `true`; installed-version and presence probes remain direct compatibility projections so existing probe behavior and call counts stay stable.

## Compatibility preserved

- npm and Bun `latest-major` / `respect-semver` strategies.
- Explicit versus default dist tags, including explicit `latest` command evidence.
- Registry URL normalization and registry-aware install/update/latest-version resolution.
- npm argv behavior and Bun trust, rollback, scoped-package parsing, presence, and version behavior through the unchanged low-level modules.
- Batch target identity, install arguments, direct provider probes, current command handlers, state, output, and root exports.

## TDD and interruption evidence

- Initial red: both provider tests failed because `src/providers/adapters/npm.ts` and `bun.ts` did not exist.
- The delegated implementation turn later stopped on an account usage limit. Its uncommitted tests and adapter files remained in the worktree; recovery resumed from `.superpowers/sdd/progress.md` without repeating completed Tasks 1/2.
- Compatibility red: three tests proved `ManagedInstaller` still bypassed typed adapters before the facade was changed.
- Additional red/green loops covered TypeScript outcome narrowing, lint-safe timeout racing, explicit `latest` evidence, and preservation of safe dependency rejection reasons.

## Validation

- Focused provider/legacy/update suite: 7 files / 153 tests passed.
- Full suite: 71 files / 790 tests passed.
- `bun run lint`: 0 warnings / 0 errors.
- `bun run format:check`: passed.
- `bun run typecheck`: passed.
- `bun run openspec:validate`: 16/16 passed.
- `bun run memory:check`: passed.

## Scope retained

- The other seven managed providers remain on the legacy registry.
- The duplicated capability table and hard-coded update groups remain until OpenSpec `4.8`.
- OpenSpec `4.2` remains unchecked until every real first-party provider uses the conformance harness.
- Catalog normalization and command/state lifecycle migration remain untouched.
