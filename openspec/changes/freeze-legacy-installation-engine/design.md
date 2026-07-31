## Context

The 1.4 release made Core the default apply route for CLI `install` and
`ensure`. The current selector chooses its route before work begins, retains
legacy for v1 dry-run planning, and accepts one exact environment override.
Existing command tests already prove that Core failures stay in the selected
engine; the missing 1.5 work is to freeze and operate that boundary rather
than to replace more lifecycle code.

## Goals / Non-Goals

**Goals:**

- Preserve the current whole-invocation selection rule for a second stable
  minor and make its precedence explicit in regression coverage.
- Give operators a safe, repeatable compatibility rollback rehearsal that
  does not require state migration, automatic fallback, or a new tool.
- State the later-major removal gate consistently in the product guides.

**Non-Goals:**

- Removing legacy `install` or `ensure`, changing state schema version 2, or
  adding a runtime deprecation warning.
- Migrating `update`, `uninstall`, or `run` to Core or adding public SDK APIs.
- Adding release orchestration, daemon, batch, MCP, or hidden fallback paths.

## Decisions

### Freeze behavior through tests and documentation, not a second dispatcher

The existing route selector is the single ownership boundary. We will extend
its behavioral tests for exact override handling and dry-run precedence,
instead of introducing a feature flag, persisted rollout state, or duplicate
router. This keeps rollback stateless and preserves the existing v1 surface.

### Rehearse rollback as a pre-invocation operator procedure

The runbook will use `QUANTEX_INSTALLATION_ENGINE=legacy` on one explicit
`install` or `ensure` invocation, collect command/result/state evidence, and
then rerun without the variable to return to Core default. It will never
recommend retrying a failed mutation in another engine after side effects
begin. This uses the already-tested escape route instead of inventing a
release-wide rollback switch.

### Make removal conditions descriptive, not executable

The 90-day and later-major gates are release-governance decisions, not an
automatic timer in the CLI. README and spec text will name them; no runtime
clock, telemetry, or state field will be added.

## Risks / Trade-offs

- [A rollback command can be mistaken for automatic recovery] → The runbook
  requires a new invocation and explicitly prohibits in-flight engine swaps.
- [The compatibility route becomes a permanent undocumented fork] → Both
  READMEs and the runbook declare it frozen for the soak and subject to a
  separately approved later-major decision.
- [A later change broadens Core by accident] → Regression coverage names the
  two promoted operations and confirms no fallback into legacy.

## Migration Plan

1. Add the route-precedence regression cases and publish the rollback runbook.
2. Merge this documentation-and-guard PR as the 1.5 soak baseline.
3. Release 1.5 only through the existing protected Release workflow; retain
   the legacy route for the full soak.
4. If a routing regression occurs, perform the documented per-invocation
   rollback; do not alter persisted state or switch engines mid-invocation.

## Open Questions

None. The later-major deprecation decision is intentionally outside this
change and cannot be pre-authorized by the soak baseline.
