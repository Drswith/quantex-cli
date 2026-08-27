## Summary

The `Release-As: 1.11.0` overrides in #670 and #671 both did nothing. Release Please still prepares `chore: release 2.0.0`, and #669 is still open at that version.

I stopped guessing and ran release-please's own dry run, as I said I would. It reproduced `updating from 1.10.0 to 2.0.0` and showed the actual cause in its generated changelog:

```
* **release:** restore automatic release preparation after the desktop rollback (a55d6e8)
```

That text is not either commit's subject — it is the text of the pull request's `BEGIN_COMMIT_OVERRIDE` block. Release-please **replaces the merged commit message with that block** on a squash-merge, which its README documents. Both times I placed the footer after `END_COMMIT_OVERRIDE`, so the message release-please actually parsed never contained it.

The failure mode is silent. There is no error, no warning, and no log line naming the override — the release is simply prepared at the computed version. Validating placement is the only point where the mistake is visible, so this PR validates it.

My earlier explanation, that a wrapped line beginning with a footer token was to blame, was wrong. The commit message was never read at all.

## Linked Artifacts

- OpenSpec: `restore-managed-update-and-resume-releases`

## Validation

- [x] `bun run memory:check`
- [x] `bun run lint`
- [x] `bun run format:check`
- [x] `bun run typecheck`
- [x] `bun run test` (if behavior changed)

`bun run openspec:validate` passes 22/22, and the suite is 172 files / 2117 passing.

## Release Intent

- Release: patch - bug fix

## Release Summary

BEGIN_COMMIT_OVERRIDE
fix(release): restore automatic release preparation after the desktop rollback

Release preparation resumes on the 1.x line. The macOS desktop rollback left
a marker in the commit range that kept forcing an ineligible 2.0.0, which
blocked every 1.x release since 1.10.0.

Release-As: 1.11.0
END_COMMIT_OVERRIDE

## Docs Updated

- [x] `docs/...`
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

**This must be squash-merged.** The override block only applies on a squash-merge; release-please's README is explicit that it does not work with a plain merge.

**What changed in the policy.** `pr-body-policy` previously accepted a `Release-As` footer anywhere in the `## Release Summary` section, which is exactly how this passed review twice while being inert. It now requires the footer inside the override block, and the rejection message explains why. The pre-existing test asserting the old placement was corrected — it encoded the bug.

**Cost of the detour.** Two merged PRs produced no release. The lesson is the one I stated on #671 and should have applied a commit earlier: for a question about how a third-party tool parses input, run the tool rather than reason about it. The dry run took one command and settled it.

**Remaining after this merges**, tasks 5.9 through 5.11 of the OpenSpec change: confirm the Release PR becomes `1.11.0` and passes `governance`, merge it, confirm the tag and publication, then verify the published package accepts `qtx update --all --managed` and `qtx update --non-interactive`.

