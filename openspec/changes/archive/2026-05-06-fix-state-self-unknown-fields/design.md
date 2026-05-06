## Context

`state.json` is Quantex's local durable state. The `self` object is expected to evolve over time, so read-modify-write operations must preserve unknown keys for forward compatibility.

The bug came from normalizing `self` by rebuilding only the typed fields. That made any later `mutateState()` call drop unknown persisted keys. The first fix preserved unknown keys, and the follow-up tightened the implementation so known keys are still normalized before returning state to callers.

## Goals / Non-Goals

**Goals:**

- Preserve unknown `self` keys across state mutations.
- Keep known `self` fields normalized to expected runtime types.
- Add regression coverage for both preservation and known-field normalization.

**Non-Goals:**

- Introducing a full schema migration system for `state.json`.
- Preserving invalid values for known `self` fields.
- Changing installed-agent state persistence semantics.

## Decisions

- Add a forward-compatible index signature to `SelfState` so unknown persisted keys can be represented deliberately.
- Normalize `self` through a helper that copies plain-object keys, then validates known fields.
- Delete invalid known fields during normalization while leaving unknown keys untouched.
- Keep the test at the state-helper level because the failure occurs during read-modify-write persistence.

## Risks / Trade-offs

- [Unknown keys may retain arbitrary JSON values] Future fields are preserved without interpretation. Mitigation: known fields are still validated before use.
- [No migration history is recorded] This is a normalization fix, not a state migration framework. Mitigation: the behavior is covered by OpenSpec and regression tests.

## Migration Plan

- Update `SelfState` and `readState()` normalization.
- Add tests for unknown-key preservation and known-key cleanup.
- Validate with lint, format, typecheck, tests, OpenSpec validation, and memory checks.

## Open Questions

- None.
