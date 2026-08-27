## Summary

Three merged pull requests have now failed to move the release off `2.0.0`. #672 diagnosed the previous failure correctly, but the commit that delivered it destroyed itself.

Release-please's dry run named the cause outright:

```
commit could not be parsed: df160ad... fix(release): require the Release-As footer inside ... (#672)
```

That commit's message explained the release-note override mechanism and wrote its two marker words literally. Release-please treats those words as a message replacement and parses only the text between them — here a sentence fragment, not a conventional commit. So it logged the line above, dropped the commit from the release, and discarded the version override it carried.

The correlation is exact: one unparseable commit in the range, one commit containing the marker words, the same commit.

## Linked Artifacts

- OpenSpec: `restore-managed-update-and-resume-releases`

## Validation

- [x] `bun run memory:check`
- [x] `bun run lint`
- [x] `bun run format:check`
- [x] `bun run typecheck`
- [x] `bun run test` (if behavior changed)

`bun run openspec:validate` passes 22/22. The suite is 172 files / 2119 passing; one run hit the known-flaky `network-lifecycle` timing assertion and two subsequent full runs were clean.

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

**Squash-merge this.** The override block only applies on a squash-merge.

**The guard added here.** A pull request commit message may not contain a marker word at all, and a body may not contain more than one occurrence of each. Both are now rejected by `bun run pr:body:check` and the commit policy, with messages that explain why. This body and its commit are written to satisfy that rule: neither names the marker words in prose, and the block below is the only occurrence.

**Why this kept recurring.** Every one of the three failures was the same class of mistake — writing prose about a parser's syntax inside text that the parser reads. The rule now lives in CI instead of in my attention.

**Remaining after merge**, tasks 5.11 to 5.13 of the OpenSpec change: confirm the Release PR becomes `1.11.0` and passes `governance`, merge it, confirm the tag and publication, then verify the published package accepts `qtx update --all --managed` and `qtx update --non-interactive`.
