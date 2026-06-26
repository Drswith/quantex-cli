## Summary

Fix a high-severity lifecycle bug where `updateAgent()` removed tracked install state after a successful managed update when cancellation fired during persistence. That left agents upgraded on disk but untracked in `state.json`, breaking later `update --all`, `uninstall`, and doctor flows. Also add install-parity managed rollback for catalog-fallback updates when persistence is cancelled.

## Linked Artifacts

- Issue:
- ADR:
- OpenSpec: `openspec/changes/fix-update-cancel-state-loss`
- Discussion:

## Validation

- [ ] `bun run memory:check`
- [x] `bun run lint`
- [x] `bun run format:check`
- [x] `bun run typecheck`
- [x] `bun run test` (if behavior changed)
- [ ] Not run, explained below

## Release Intent

- Release: not applicable - docs/process/test-only change
- Release: patch - bug fix
- Release: minor - user-facing feature
- Release: major - breaking change

## Docs Updated

- [ ] Not needed
- [ ] `docs/...`
- [x] `openspec/...`
- [ ] Follow-up issue or OpenSpec change created instead

## Scope Check

- [x] I did not add a new ad hoc root-level Markdown file.
- [x] I updated the relevant issue, ADR, spec, runbook, or captured the missing doc work as follow-up.
- [x] I did not silently expand project scope without recording it explicitly.

## Closure Check

- [x] Working tree was clean after commit.
- [x] Branch was pushed and this PR is the active delivery artifact.
- [x] OpenSpec change is not needed, still active by design until merge, already archived, or queued for agent-driven archive closure.
- [ ] Release is not applicable, delegated to release automation, or verified.

## Notes

Root cause: the 0.25.2 install cancellation hardening reused install-style post-persistence cleanup for updates, but uninstalling tracked state after a successful update is incorrect because the package mutation cannot be rolled back to "untracked". The preferred-state path now keeps existing state and reports failure; the no-recorded-state fallback path now rolls back like install.

Remaining owner after merge: archive `fix-update-cancel-state-loss` into `openspec/specs/agent-update/spec.md`.
