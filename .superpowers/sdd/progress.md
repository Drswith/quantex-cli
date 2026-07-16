# Windows Promotion Release Recovery Progress

Base: `origin/main@cf7555a2be8f1094a19d5a340a2b0f56ac033a97`

Plan: `docs/superpowers/plans/2026-07-16-windows-promotion-release-recovery.md`

| Task | State | Checkpoint | Evidence |
| --- | --- | --- | --- |
| 1. Correct deterministic platform assumptions | complete | local recovery checkpoint | PATHEXT-aware Bun resolution; Windows extensionless and `.cmd`/`.bat` shims use argv-preserving `cross-spawn`; `doctor` reuses its invocation context; provider fixtures are serial, low-CPU, self-expiring, and failure-cleaned; read-only signal permits one bounded tree; managed-installer E2E unconditionally force-kills its outer process group; all targeted process suites pass and end with zero fixture Bun processes |
| 2. Diagnose compatibility delta | complete | Windows dispatch checkpoint | runs 29483186421/29483475676/29483786949 exposed host/golden deltas; run 29485082876 proved direct Bun spawn could not launch `.cmd`; compiled run 29485866079 exited code 5 under multiplied Bun runtimes; local interruption later exposed #464's overwritten PID log and missing runner-crash containment, accounting for 68 orphaned/high-CPU fixture processes across interrupted runs |
| 3. Validate before PR | in progress | validation checkpoint | exact-SHA run 29489832910 exposed missing `cross-spawn` mocks; run 29490764322 passed lint/Ubuntu/macOS, then Windows job 87596096051 exposed the remaining Bun-style argv/completion versus Node `ChildProcess` mock-shape delta. A shared adapter now covers both launch contracts; the network-timeout compatibility test uses an isolated PATH instead of real runner tools; the Windows root-export import has an explicit 15-second budget. Independent review Go; lint/format/typecheck, OpenSpec 16/16, and memory green; affected tests passed 13 files/154 tests with 1 Windows-only skip; full `maxWorkers=2` suite passed 129 files/1584 tests with 1 platform skip; live checks observed at most three Bun processes and zero leftovers; one updated exact-SHA branch dispatch remains before PR |
| 4. Deliver recovery to main | in progress | delivery checkpoint | amend/push the final single commit, require the updated exact-SHA dispatch on Windows/Ubuntu/macOS/lint, create a Ready main PR, pass required contexts/governance, manually rebase-first merge, then observe green main CI and Release |

Baseline: #468 rebase-merged successfully and ledger content verification passed, earning support 4.4. The post-merge main Windows suite failed before Release, so 4.5 and teardown/archive tasks remain pending.

Recovery rule: resume the first incomplete row after refreshing main CI, Release runs, the recovery branch dispatch, OpenSpec counters, CodeGraph, and git state. Remote Windows evidence drives corrections; retry only interrupted network operations.
