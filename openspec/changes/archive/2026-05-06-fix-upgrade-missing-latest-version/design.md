## Context

`quantex upgrade` decides availability from `inspectSelf()`. Registry or release metadata lookup can fail, leaving `latestVersion` unresolved. The command must keep that unknown state distinct from a resolved latest version that is not newer than the installed CLI.

After the first fix, plain managed upgrades could also reach provider verification with no resolved target version. In that case, a successful package-manager install that leaves the semantic version unchanged should not be treated as a verification failure solely because Quantex had no expected target to compare against.

## Goals / Non-Goals

**Goals:**

- Keep the `up-to-date` result limited to cases with a resolved `latestVersion`.
- Preserve the existing `check-unavailable` result for explicit checks when latest metadata cannot be resolved.
- Avoid false managed verification failures when no target version was available before installation.

**Non-Goals:**

- Redesigning registry lookup, version cache semantics, or package-manager install behavior.
- Changing the structured result schema beyond existing self-upgrade statuses.
- Hiding real verification failures when an expected target version is known.

## Decisions

- Gate the early `up-to-date` branch on both a resolved `latestVersion` and `!updateAvailable`.
- Keep unresolved explicit checks on the existing `NETWORK_ERROR` / `check-unavailable` path.
- Keep managed verification strict when an expected target exists, but skip the unchanged-version failure when `latestVersion` was unresolved before installation.
- Cover both command branching and managed verification with focused regression tests.

## Risks / Trade-offs

- [Unknown latest can still trigger provider work for plain upgrades] The command may attempt a managed install when no target version was resolved. Mitigation: verification no longer reports a false failure solely because the version is unchanged, while real package-manager failures still surface.
- [Verification remains dependent on package-manager behavior] If the package manager reports success without changing anything, Quantex reports success only when there was no target to validate. Mitigation: when a target is known, mismatch and unchanged-version checks remain strict.

## Migration Plan

- Update `upgradeCommand()` branching and managed verification guards.
- Add regression coverage for unresolved latest metadata in `upgrade --check` and managed verification.
- Sync self-upgrade OpenSpec requirements.
- Validate with lint, format, typecheck, tests, OpenSpec validation, and memory checks.

## Open Questions

- None.
