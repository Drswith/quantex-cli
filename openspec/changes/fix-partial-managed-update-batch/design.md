## Context

`quantex update --all` groups managed updates by installer type so one installer invocation can update multiple packages. The grouped command receives only package specs with non-empty package names, but the higher-level result currently maps grouped success back to every agent in the bucket.

## Goals / Non-Goals

**Goals:**

- Ensure grouped update success is reported only for agents that actually contributed package work to the grouped installer invocation.
- Preserve existing per-agent fallback behavior for entries whose package spec cannot be resolved.

**Non-Goals:**

- Change installer command semantics.
- Add new package metadata or version lookup behavior.
- Redesign update planning beyond the package-less grouped-entry split.

## Decisions

- Split package-less entries during service-level plan materialization, before command execution.
  - Rationale: command execution can keep treating each grouped bucket as internally valid, and existing `performUpdate` fallback already handles per-agent failure/manual outcomes.
  - Alternative considered: leave all entries in the bucket and have `updateGroupedAgents` mark package-less entries separately. That would duplicate fallback behavior in the command layer and keep invalid work mixed into a grouped execution unit.

## Risks / Trade-offs

- [Risk] A package-less entry might still fail in per-agent fallback.
  - Mitigation: that failure is the accurate outcome and prevents a false `updated` result.
- [Risk] Result ordering can place package-less fallbacks after grouped bucket results.
  - Mitigation: existing output already groups by execution path; correctness of per-agent status is the priority.
