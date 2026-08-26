## Why

`v1.10.0` is the published release, and nothing has shipped since 2026-08-14. Fifteen commits sit unreleased on `main`, including three user-facing `feat` entries: the five-agent catalog withdrawal, the install-provider narrowing, and DeepSeek Harness. Users installing `quantex-cli` today still get the desktop-era CLI.

The reason is not an automation defect. `revert!: remove macOS desktop client` (`d92c7bc`) reverted four commits as one blanket rollback, and two of the things it removed were published v1 CLI surface rather than desktop code:

- `update --all --managed`, which limits the batch to persisted Quantex-managed agents
- `update --non-interactive`, which four other commands still accept

Both shipped to npm in `v1.10.0`. Removing them is a genuine breaking change, so Release Please correctly computes `2.0.0` on every push, and `compatibility-contract` already requires that deleting "another maintained v1 surface" before the later-major decision be rejected. `main` is currently in that rejected state.

Stable `2.x` is deferred until a required v2 refactor merges and stabilizes for 90 days, and that refactor has not been identified, so the major path has no start date. To stop Release Please recreating an ineligible `2.0.0` Release PR, `defer-v2-release` set `skip-github-pull-request: true`, which blocks **every** Release PR, `1.x` included. The freeze is the compatibility contract working correctly; the fix is to stop `main` carrying an unapproved v1 removal, not to weaken a gate.

Neither removed option depends on the desktop client. `--managed` resolves to `Object.keys((await loadState()).installedAgents)` instead of the catalog — a CLI concept that merely happened to arrive in the desktop PR. Restoring both makes `main` a minor again, which lets Release Please prepare `1.11.0` on its own and lets the stable-v2 gate return to the three precise layers its own design intended.

Work-intake classification: observable CLI behavior, the stable command catalog and structured output, and durable release-process contracts. That requires an OpenSpec change before edits.

## What Changes

- Restore the `--managed` option on `update`, its managed batch scope, its `--managed` without `--all` rejection, and `data.scope: "managed"` in structured output.
- Restore `nonInteractive` to the `update` command contract's global options.
- Resume Release Please Release PR preparation by removing `skip-github-pull-request: true`. The stable-v2 denial stays in the three layers that name a version: generated Release PR validation, deterministic tag planning, and publication identity validation.
- Record that the blanket Release PR pause is lifted because `main` no longer computes a stable `2.x`, not because the v2 readiness requirement changed. The refactor and its 90-day stabilization remain unsatisfied and stable `2.x` remains denied.
- Regenerate the v1 command-family goldens, whose `update` digests moved when the options were removed.

**Not changing** (deliberately):

- No desktop client code, workflow job, sidecar script, or `macos-desktop-client` spec returns. Only the two CLI surfaces come back.
- `test/workflow-classification.test.ts` keeps its post-revert shape. Its removed assertions covered the `desktop-macos` CI job, which stays deleted.
- The v2 readiness requirement is untouched. This change does not identify the required refactor, start its clock, or make any stable `2.x` version eligible.
- No one-shot release path, `Release-As` override, or manual version edit. Once `main` is a minor, ordinary release-please preparation is sufficient.

## Capabilities

### Modified Capabilities

- `agent-update`: restore the managed-only batch update scope requirement.
- `cli-contract-registry`: restore the `--managed` option and managed scope in the update command contract.
- `release-workflow`: Release PR preparation resumes; the deferred-v2 pause scenario is replaced.
- `major-release-readiness`: the gate denies stable `2.x` at version-naming layers rather than by suppressing Release PR creation.

## Impact

- Users regain `qtx update --all --managed` and `qtx update --non-interactive`, which `v1.10.0` shipped and `main` had dropped.
- The next push to `main` after this merges produces a `1.11.0` Release PR, and merging it publishes the fifteen-commit backlog.
- Stable `2.x` stays denied. A future change that identifies the required refactor and records 90 elapsed days is still the only way to lift it.
