# Self-Upgrade Integration Milestone Progress

Base: `origin/codex/redesign-lifecycle-integration@09fe7b1a57dd0482b91ee1a6d24f314e5b8bad56`

Plan: `docs/superpowers/plans/2026-07-15-self-upgrade-integration-milestone.md`

| Task | State | Checkpoint | Evidence |
| --- | --- | --- | --- |
| 1. Cache-only passive metadata | complete | task-1 commit | typed source/channel metadata; passive cache-only projection; 107 focused compatibility/network/self tests plus static/OpenSpec gates pass |
| 2. Invocation-scoped self-upgrade service | complete | task-2 commit | per-invocation application/composition, shared cache/lock/signal/timeout, v1 presenter retained; 81 focused tests and static/OpenSpec gates pass |
| 3. Managed process/network ports | complete | managed-process + network commits | child `ProcessPort`, exact Bun/npm argv/verification, fetch `NetworkPort`, and injected registry/release resolution pass 120 focused tests plus static/OpenSpec gates |
| 4. Binary/Windows runtime ports | complete | binary-port + persistence/fault commits | standalone download/verification use shared network/process ports; install-source evidence uses shared persistence; cancellation/timeout retain typed interruption; atomic rollback and Windows quoting/peer/delayed-swap coverage pass 94 focused self/state tests plus static/OpenSpec gates |
| 5. Release validation and PR delivery | in progress | PR #460 initial head | 1544/1544 full tests, static/OpenSpec/memory gates, build, five binaries, package, artifacts, release smoke, isolated Bun-managed self-upgrade, and initial remote lint/Ubuntu/Windows/macOS/Modal sandbox all pass; both independent reviews have no remaining Critical/Important; tasks 9.1-9.5 are complete at 53/74, while normalized-head CI, merge, and integration verification remain pending |

Baseline: lint, format check, and typecheck pass on integration tip `09fe7b1`. The initial full suite reported 1491/1494 with three concurrent signal/timing failures; an immediate focused rerun of the affected files passed 53/53, so recurrence must be classified with systematic debugging rather than silently accepted. CodeGraph is initialized with 460 files, 4023 nodes, and 10466 edges.

Recovery rule: resume the first row that is not `complete`; inspect its tests, `git log`, `git status`, and CodeGraph pending-sync banner before editing. Commit every reviewed task, preserve the granular head on `refs/quantex/recovery/redesign-self-upgrade-granular`, and normalize only immediately before a PR to `codex/redesign-lifecycle-integration`.
