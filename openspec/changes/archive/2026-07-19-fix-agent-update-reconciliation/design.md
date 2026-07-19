## Context

The lifecycle update service currently plans every catalog entry, then suppresses only one exact absent observation shape. Candidate-provider uncertainty therefore turns a never-installed agent into a failed batch target. The same service also requires the recorded provider to resolve a target version before planning any update, so it bypasses the existing `AgentDefinition.selfUpdate` strategy for tracked script and binary installs.

The command layer then projects similar blocked outcomes differently for single and batch execution. Existing state reconciliation already recognizes `recorded-absent` observations and `qtx uninstall <agent>` can safely clear conclusive ghost evidence.

## Goals / Non-Goals

**Goals:**

- Make batch eligibility depend on installed/executable evidence rather than candidate-provider availability.
- Preserve recorded install provenance while executing declared self-update commands.
- Verify self-update results from fresh version observations.
- Keep stale state non-fatal during batch update and provide explicit reconciliation guidance.
- Use one command projection for equivalent single and batch outcomes.

**Non-Goals:**

- Automatically adopt or manage PATH-only agents.
- Silently delete stale state during `update`.
- Add an ignore list, daemon, workflow engine, or new top-level command.
- Reclassify script installs as package-manager-managed installs.

## Decisions

### Filter catalog-only absence from observed facts

The batch planner will suppress an agent whenever no executable, installed state, or lifecycle receipt exists. Provider drift does not override those absence facts. This retains catalog scanning for PATH-only discovery while preventing unavailable candidate installers from creating false failures.

Alternative considered: list only persisted state names. Rejected because existing behavior intentionally reports untracked PATH executables without mutating them.

### Model provider and self-update execution separately

The update plan will distinguish managed-provider execution from self-update execution. A self-update plan carries the declared command and pre-update version but leaves the recorded script or binary binding unchanged. It does not require `resolveLatestVersion`, because upstream self-updaters often choose their own target.

Alternative considered: call the legacy `updateAgentOutcome` service. Rejected because it also performs install-method fallback and state mutation outside the new lifecycle planning and verification boundary.

### Verify self-update by fresh observation

After a successful self-update command, Quantex will observe the agent again. A changed comparable version is `updated`; an unchanged comparable version is `up-to-date`; disappearance, source drift, or an unobservable post-update version is a verification failure. Successful verification may write a lifecycle receipt while retaining installed-state provenance.

### Keep ghost cleanup explicit

A conclusively absent agent with recorded evidence is excluded from update execution and reported as a non-fatal stale-state warning with `qtx uninstall <agent>` remediation. `update` will not delete evidence because temporary PATH/provider failures must fail closed.

### Share outcome projection

Single and batch handlers will use the same conversion from lifecycle planning/execution outcomes to `UpdateResultItem`. No new update status enum value is required; stale targets use structured warnings instead of failed result entries.

## Risks / Trade-offs

- [A self-updater exits successfully without changing a version] → Report `up-to-date`, matching the existing agent-update contract.
- [A self-updater cannot be version-probed afterward] → Fail verification instead of claiming success.
- [A stale state warning remains until the user reconciles it] → Provide a precise `qtx uninstall <agent>` command and keep the update batch successful.
- [Provider uncertainty could hide a catalog-only installation outside PATH] → Without executable or persisted evidence Quantex has no ownership proof and must not treat the agent as installed.

## Migration Plan

1. Add contract and focused regression tests.
2. Introduce the self-update execution plan and typed executor port.
3. Apply batch filtering, stale warnings, and shared projection.
4. Validate stable JSON/NDJSON fixtures and the full repository suite.
5. Release as a patch; rollback is a normal revert because no state schema migration is introduced.

## Open Questions

None.
