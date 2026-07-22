# Task 7 Report: Verify Read-Only Observation Migration

## Result

The real CLI smoke harness runs `list`, `info`, `inspect`, `resolve`, `capabilities`, and `doctor` in human and JSON modes across absent, tracked, untracked, and ghost Codex fixtures. Each fixture uses an isolated temporary HOME, controlled PATH sentinels, and a seeded version cache.

The 48-invocation matrix verifies parseable JSON v1 envelopes, fixture-specific stable command fields and `AGENT_NOT_INSTALLED` guidance, meaningful human markers, unchanged state-file bytes after every command, and guarded read-only process execution. Host-dependent paths, versions, and availability values are normalized rather than golden-locked. The same canonical normalized summary is compared locally and in the Bun container.

## Debugging evidence

- Initial focused RED: `absent/human/list` changed `state.json` bytes because source execution reconciled the unrelated self-install source and migrated the legacy fixture to schema v2.
- Fix: the temporary HOME still consumes the existing v1 compatibility fixtures, but projects them to current state with the already-detected `source` self install source before starting the agent lifecycle smoke boundary.
- Initial Docker RED: Bun 1.3.11 plus Vitest produced an undefined `z` while the smoke module imported the full agent catalog only to seed version-cache keys. Direct Bun 1.3.11 Zod imports worked.
- Fix: cache setup reads the generated catalog support input instead. The child CLI still loads and executes the real production catalog and command paths.

## Validation

- Host focused smoke: 3 files / 24 tests passed; 48 real CLI invocations.
- Host direct harness: 48 real CLI invocations passed.
- `oven/bun:1.3.11` smoke: 3 files / 24 tests passed after frozen install in the read-only source-copy topology.
- Full suite: 98 files / 1058 tests passed.
- Format check passed; lint reported 0 warnings and 0 errors; typecheck passed.
- OpenSpec validation passed 16/16; project memory check passed; build passed.

## Review fixes

- Compatibility RED: three tests failed because no deterministic baseline, normalized summary, or fixture-swap rejection existed. GREEN locks list/info/inspect/resolve lifecycle, source, update, error, and guidance fields; capabilities/doctor stable markers; command-specific human markers; and fixture state/executable identity. Swapping tracked/untracked or absent/ghost now fails baseline comparison.
- Mutation-guard RED: fourteen deliberate mutation/effect probes lacked `READ_ONLY_MUTATION_BLOCKED`, while two observation probes could not run without the preload. A later self-review RED proved a probe-shaped package name could bypass the Bun rule. GREEN uses a real Bun preload to intercept child CLI `Bun.spawn`/`spawnSync`, allows only exact declared observation probes, records every allowed spawn, and rejects provider mutations, mise `use`/`unuse`, shell/script execution, and unknown executable effects. Seventeen guard tests pass.
- Timeout RED: two tests failed because no bounded child-wait API existed. GREEN proves normal close resolution and hung-child SIGTERM -> grace -> SIGKILL rejection; real CLI commands use the same 30-second timeout and one-second hard-kill grace.

## State

- OpenSpec `5.1` through `5.7` are complete; `redesign-lifecycle-engine` is active at 37/74.
- Independent re-review approved Task 7 with no Critical, Important, or Minor findings.
- The controller reran the 3-file / 24-test real-CLI smoke gate plus format, lint, typecheck, OpenSpec 16/16, and memory checks successfully; OpenSpec remains active at 37/74.
- Task 8, current-spec synchronization, archive closure, push, PR, and release work remain intentionally out of scope.
