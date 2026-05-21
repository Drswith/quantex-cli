## Context

The Release workflow publishes npm packages, uploads GitHub release binaries, and dispatches an alias-package sync. The alias sync is useful, but it is not the source of truth for Quantex CLI binaries. If it fails before `gh release upload`, users can receive an npm version whose corresponding binary artifacts are absent from the GitHub Release.

## Goals / Non-Goals

**Goals:**

- Ensure binary artifacts are uploaded before auxiliary alias synchronization can fail the publish job.
- Keep the release workflow simple and native to GitHub Actions.
- Preserve strict failure reporting for alias sync after primary artifacts are safe.

**Non-Goals:**

- Redesign release-please, npm publishing, or alias repository synchronization.
- Add retry queues, workflow orchestration, or new repo-local release commands.

## Decisions

- Move `Upload release artifacts` before `Sync quantex alias package`.
  - Rationale: the binary artifacts are part of the primary release output, while alias sync is downstream coordination.
  - Alternative considered: mark alias sync `continue-on-error`. That would protect binary upload too, but it could hide a real alias sync failure from release maintainers.

## Risks / Trade-offs

- Alias sync can still fail the publish job after artifacts are uploaded. -> This is acceptable because the primary release is complete and the failing auxiliary sync remains visible.
- If artifact upload fails, alias sync will not run. -> This preserves the current fail-fast behavior for incomplete primary releases.

## Migration Plan

Merge the workflow ordering change. No data migration is required. If rollback is needed, revert the workflow commit.

## Open Questions

None.
