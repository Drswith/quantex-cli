## Context

`install` and `ensure` already construct one Core session for an entire apply invocation when their internal route is Core. The route is selected before command execution, Core owns its verification and recovery, and focused tests cover the retained v1 presentation path. The production selector is the remaining legacy-default switch.

The transition must keep the state schema at version 2, avoid mutating-engine shadow execution, and preserve an operational rollback path while a second stable minor soaks. A new command option would change the v1 command contract and a persisted setting would introduce unnecessary state/config compatibility work.

## Goals / Non-Goals

**Goals:**

- Make Core the default engine for applying exactly `install` and `ensure`, while keeping v1 `--dry-run` planning on its legacy route.
- Preserve a deterministic whole-invocation legacy escape before observation, locks, providers, filesystem, or state effects.
- Keep routing diagnostics private to debug stderr and preserve all maintained v1 output and exit contracts.
- Record the promotion and its bounded rollback policy where maintainers and users can find it.

**Non-Goals:**

- Do not add a CLI option, config key, state field, SDK option, workflow, daemon, or second package.
- Do not migrate `update`, `uninstall`, `run`, prompts, batch composition, or self-upgrade.
- Do not retry a failed Core invocation through legacy or vice versa.
- Do not remove legacy routing in this minor; that remains gated by the second stable-default soak and a separate major-version decision.

## Decisions

### Default Core only for the proven command family

The selector returns the immutable Core stable-default route for non-dry-run `install` and `ensure`. The command implementations already branch on that route before lifecycle work, so this replaces one selector constant instead of adding a parallel integration layer. `--dry-run` has no lifecycle side effect and retains its legacy v1 planning route: Core's fail-closed provider probe correctly rejects unknown evidence, while v1 dry-run historically reports the useful plan without treating a missing package-manager probe as a mutation failure.

`update`, `uninstall`, and `run` retain their existing implementations. This is intentionally a family-level promotion, not a claim that the whole lifecycle stack is Core-ready.

### Use one narrow environment escape rather than a new CLI surface

`QUANTEX_INSTALLATION_ENGINE=legacy` selects the immutable legacy route for the complete `install` or `ensure` invocation. It is a compatibility/rollback control, not a general engine-selection feature: no `core` value, persistent preference, or command flag is introduced. Values other than the exact `legacy` value leave the stable Core default in effect.

This keeps current command syntax and the frozen state schema untouched. It also lets an operator recover by setting one process-scoped value before retrying, rather than risking a cross-engine retry inside the failed process.

### Keep the existing selected-engine boundary

The selected route is passed into the command handler exactly once. The Core route owns its session and disposal; the legacy route owns its existing locks and recovery. Neither command may invoke the other engine after selection. Debug stderr is the only route observability and remains excluded from human, JSON, and NDJSON payloads.

## Risks / Trade-offs

- [A Core regression affects the new default] → preserve the process-scoped legacy escape, keep differential/conformance coverage, and retain legacy through the second default stable minor.
- [An environment typo silently selects the default] → only the exact `legacy` value has meaning; the default route is Core regardless of unrelated inherited variables.
- [The escape route or dry-run compatibility path becomes a permanent public feature] → document both as 1.x compatibility controls and require a separate major-version deprecation decision for removal.
- [The change is mistaken for a full migration] → explicitly limit code, tests, ADR, and README to `install` and `ensure`.

## Migration Plan

1. Add the routing and documentation contract, including the retained legacy escape boundary.
2. Change the selector and its focused tests; run the existing Core/legacy differential suite as regression evidence.
3. Ship in the next compatible CLI minor, with Core default for apply `install` and `ensure` while dry-run retains its v1 plan behavior.
4. If a production issue requires rollback, retry the affected invocation with `QUANTEX_INSTALLATION_ENGINE=legacy`; never fall back after side effects.
5. Keep the route through the 1.5 soak. Any removal proceeds only under a separate later-major deprecation change.

## Open Questions

None. The selected command family and the release-train compatibility boundary are already established by ADR 0007.
