# Typed Outcomes and Legacy Core Removal Progress

Base: `origin/codex/redesign-lifecycle-integration@05409ecfec3df9b2f708dd1482b5d77d72143ae6`

Plan: `docs/superpowers/plans/2026-07-15-legacy-core-removal-milestone.md`

| Task | State | Checkpoint | Evidence |
| --- | --- | --- | --- |
| 1. Remaining legacy route inventory | complete | task-1 checkpoint | Structural tests identify retained compatibility wrappers, default observation imports, boolean provider bridges, and migration-only shadow planning |
| 2. Typed internal mutation outcomes | complete | typed provider checkpoint | Lifecycle, typed managed installers, and provider mutation dependencies preserve discriminated outcomes; root v1/package-manager boolean APIs project explicitly at compatibility edges |
| 3. Default observation/install migration | complete | task-3 checkpoint | Install, ensure, and execution preflight use lifecycle observations; reconciliation accepts a minimal domain snapshot; focused tests pass 86/86 |
| 4. Unreachable legacy core removal | complete | legacy-core checkpoint | Zero-caller shadow planner is removed; default commands no longer consume legacy inspection; the generic pending-operation helper is no longer mislabeled as legacy; v1 facade exports remain |
| 5. Verified docs and OpenSpec update | complete | docs/OpenSpec checkpoint | English and Chinese product guarantees reflect verified defaults; catalog/schema generators are clean after formatting; OpenSpec 2.4 and 10.4-10.6 are complete at 68/74 |
| 6. Validation, reviews, and integration PR | in progress | local-review checkpoint | Full local gates and independent spec/quality re-reviews have no remaining Critical/Important findings; recovery commit, rebase normalization, ready integration PR, and remote checks remain |

Baseline: integration tip `05409ec`; OpenSpec `redesign-lifecycle-engine` remains active at 68/74. CodeGraph is initialized and synchronized in this worktree with 487 files, 4,522 nodes, and 12,014 edges.

Recovery rule: resume the first row that is not `complete`; inspect its tests, `git log`, `git status`, granular recovery ref, OpenSpec status, and CodeGraph pending-sync banner before editing. Commit every reviewed task, preserve the granular head at `refs/quantex/recovery/redesign-legacy-removal-granular`, and normalize only immediately before a PR to `codex/redesign-lifecycle-integration`.
