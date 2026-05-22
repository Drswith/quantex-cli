## Context

Grouped managed updates acquire the lifecycle lock once while invoking the package manager batch operation. If that batch operation reports failure, command-layer fallback currently calls per-agent `updateAgent` concurrently. Each `updateAgent` call also acquires the lifecycle lock, and the lock is intentionally not re-entrant across concurrent same-process attempts.

## Goals / Non-Goals

**Goals:**

- Ensure grouped update fallback attempts every affected agent without local lock contention.
- Preserve current result rendering and error semantics for real external lock conflicts.
- Keep the fix localized to update execution.

**Non-Goals:**

- Redesign lifecycle locking.
- Change package-manager batch update semantics.
- Add retry loops or background orchestration.

## Decisions

- Run fallback per-agent updates sequentially after grouped update failure.
  - Rationale: sequential execution matches the single lifecycle resource protected by `updateAgent` and avoids falsely reporting a same-process fallback as externally locked.
  - Alternative considered: make the lifecycle lock re-entrant. That would change a shared concurrency primitive used by install, update, uninstall, and state tracking, increasing blast radius for a narrow bug.

## Risks / Trade-offs

- Sequential fallback can be slower than concurrent fallback when many agents are in the failed group. This path only runs after a grouped package-manager update fails, and correctness is more important than fallback parallelism.
