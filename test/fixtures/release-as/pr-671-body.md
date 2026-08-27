## Summary

The `Release-As: 1.11.0` override merged in #670 was not honoured: Release Please still prepared `chore: release 2.0.0`, and PR #669 is still open at that version.

The cause is in #670's own commit message, and it is my mistake. The body wrapped so that one line began with the two words that a conventional-commit parser treats as a breaking-change footer token. The message therefore carried a second breaking marker beside the override, and the release-please run logged only `updating from 1.10.0 to 2.0.0` without acting on the override.

Release Please documents the canonical form as a commit whose body carries the `Release-As` footer and nothing else that can be parsed as a footer. This PR is exactly that: a short message, one footer line, and no line beginning with a footer token. The only file change records the correction on the active OpenSpec change.

## Linked Artifacts

- OpenSpec: `restore-managed-update-and-resume-releases`

## Validation

- [x] `bun run memory:check`
- [x] `bun run lint`
- [x] `bun run format:check`
- [x] `bun run typecheck`
- [ ] `bun run test` (if behavior changed)
- [x] Not run, explained below

`bun run openspec:validate` passes 22/22. `bun run test` is not rerun: the only file change is a task list on an OpenSpec change, with no source, fixture, or workflow edit. #670 ran the full suite at 2116 passing.

## Release Intent

- Release: patch - bug fix

## Release Summary

BEGIN_COMMIT_OVERRIDE
fix(release): restore automatic release preparation after the desktop rollback

Release preparation resumes on the 1.x line. The macOS desktop rollback
left a breaking-change marker in the commit range that kept forcing an
ineligible 2.0.0, which blocked every 1.x release since 1.10.0.
END_COMMIT_OVERRIDE

Release-As: 1.11.0

## Docs Updated

- [x] `openspec/...`

## Scope Check

- [x] I did not add a new ad hoc root-level Markdown file.
- [x] I updated the relevant issue, ADR, spec, runbook, or captured the missing doc work as follow-up.
- [x] I did not silently expand project scope without recording it explicitly.

## Closure Check

- [x] Working tree was clean after commit.
- [x] Branch was pushed and this PR is the active delivery artifact.
- [x] OpenSpec change is not needed, still active until this merge, active across milestone merges by design, queued for agent-driven archive closure after completion, or already archived.
- [x] Release is not applicable, delegated to release automation, or verified.

## Notes

**Please merge this without squashing it into a longer message.** The whole point is that the merged commit body stays short and carries exactly one footer line. #670's body is what broke the previous attempt.

**This PR is the first real use of the allowance added in #670.** It changes only `openspec/`, so `classifyChangedFiles` reports it as process-only, and before #670 the `Release-As` footer would have been rejected outright. The declared major is `1`, equal to the current released major, so the allowance applies and the deferred major stays unreachable.

**`1.11.0` remains the honest version.** The evidence recorded on #670 is unchanged: between published `v1.10.0` and `main`, root exports are byte-identical at 117 names, the v1 command fixture holds 15 commands and 4 aliases on both sides with none added or removed, no exit code moved, and only catalog-derived digests changed.

**If this still does not take**, the next diagnostic step is to run release-please's own dry run against the repository rather than to guess again, and I will report what it computes before proposing anything further.

