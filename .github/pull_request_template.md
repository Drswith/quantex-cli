## Summary

Describe the change and why it exists.

## Linked Artifacts

- Issue:
- ADR:
- OpenSpec:
- Discussion:

## Validation

- [ ] `bun run memory:check`
- [ ] `bun run lint`
- [ ] `bun run format:check`
- [ ] `bun run typecheck`
- [ ] `bun run test` (if behavior changed)
- [ ] Not run, explained below

## Release Intent

- Release: not applicable - docs/process/test-only change
- Release: patch - bug fix
- Release: minor - user-facing feature
- Release: major - breaking change

## Release Summary

- Not applicable - this source PR does not produce a release entry.
- For a release-worthy source PR, replace this with a non-empty release-please commit override written for users.
- For a one-shot release, also declare the same `Release-As: <version>` footer that the merged commit carries.

## Docs Updated

- [ ] Not needed
- [ ] `docs/...`
- [ ] `openspec/...`
- [ ] Follow-up issue or OpenSpec change created instead

## Scope Check

- [ ] I did not add a new ad hoc root-level Markdown file.
- [ ] I updated the relevant issue, ADR, spec, runbook, or captured the missing doc work as follow-up.
- [ ] I did not silently expand project scope without recording it explicitly.

## Closure Check

- [ ] Working tree was clean after commit.
- [ ] Branch was pushed and this PR is the active delivery artifact.
- [ ] OpenSpec change is not needed, still active until this merge, active across milestone merges by design, queued for agent-driven archive closure after completion, or already archived.
- [ ] Release is not applicable, delegated to release automation, or verified.

## Notes

Anything reviewers should pay extra attention to.
