## Context

`runSelfUpgradeApplication` already fail-closes: when planning yields `check-unavailable`, `manual-required`, or `up-to-date`, it returns `{ kind: 'planned' }` and does not mutate. `upgradeCommand` maps `up-to-date` and `manual-required` on the apply path, and maps unresolved latest only inside the `--check` / dry-run branch. The remaining apply-path `check-unavailable` plan then hits `if (outcome.kind !== 'executed') throw new Error(...)`. Command runtime rethrows that `Error`, so JSON and human modes both lose the structured `NETWORK_ERROR` contract.

The `--check` / dry-run branch then treats every non-`update-available` status as `NETWORK_ERROR`, which also swallows `manual-required`.

## Goals / Non-Goals

**Goals:**

- Return structured `NETWORK_ERROR` / `check-unavailable` for unresolved latest on every `upgrade` entry, including apply.
- Return structured `MANUAL_ACTION_REQUIRED` for non-auto-update sources on `--check` and dry-run.
- Keep apply-path mutation gated on `kind: 'executed'`.

**Non-Goals:**

- Changing how latest versions or install sources are resolved.
- Changing self-upgrade execution, verification, or rollback.
- Broad command-runtime exception mapping.

## Decisions

- Handle plan statuses before the executed-result guard, instead of converting the thrown `Error` in `command-runtime`. The application already produced a typed plan; the command layer is the missing mapper.
- Keep the executed-result throw as a fail-closed invariant for unexpected `planned` + `update-available` apply paths. That combination is not a supported production outcome.
- Do not treat `--check` `manual-required` as `update-available`. Source / unknown installs still cannot auto-update; `--check` must keep that classification rather than inventing a network failure.

## Risks / Trade-offs

- [Risk] Callers that parsed the unstructured crash string lose that signal. → Mitigation: they already could not rely on a stable error code; structured `NETWORK_ERROR` is the published contract.
- [Risk] `--check` on a source install now reports `MANUAL_ACTION_REQUIRED` (exit 8) instead of `NETWORK_ERROR` (exit 6). → Mitigation: this matches the apply path and the install-source contract; add an explicit regression test.
