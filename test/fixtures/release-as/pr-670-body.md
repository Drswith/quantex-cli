## Summary

The first preparation run after #668 generated `chore: release 2.0.0` ([#669](https://github.com/Drswith/quantex-cli/pull/669)), not `1.11.0`.

**#668's design was wrong on this point, and I own that.** It assumed restoring the removed v1 surface would let release-please compute a minor unaided. Release-please reads the conventional-commit markers in the `v1.10.0..main` range, and `d92c7bc revert!:` is still in that range carrying `!`. Restoring the surface changes what the code does, not what that commit message says — so a major is computed no matter how complete the restoration is. The range only stops carrying the marker once a release lands after it, which means exactly one release has to name its own version.

**The rest of #668 was confirmed correct by the same run.** #669 was created and then rejected by `governance` with the deferred-readiness reason. That is precisely what the narrowed gate is specified to do: deny a named version rather than suppress preparation, so eligible 1.x releases are no longer blocked as a side effect.

## Linked Artifacts

- OpenSpec: `restore-managed-update-and-resume-releases`

## Validation

- [x] `bun run memory:check`
- [x] `bun run lint`
- [x] `bun run format:check`
- [x] `bun run typecheck`
- [x] `bun run test` (if behavior changed)

`bun run openspec:validate` passes 22/22. `bun run release:dry-run` is not rerun: it guards the build-candidate chain and `release.yml`, and this touches neither — it changes a CI governance script. #668 exercised it in full.

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

- [x] `docs/...`
- [x] `openspec/...`

`docs/runbooks/releasing-quantex.md` documents the boundary-only one-shot.

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

**`1.11.0` is honest, and the repository's own v1 fixtures prove it.** Between published `v1.10.0` and `main`:

| Check | Result |
|---|---|
| `root-exports.json` | byte-identical, 117 names |
| v1 commands | 15 → 15, none added or removed |
| v1 aliases | 4 → 4, none added or removed, no digest moved |
| exit codes | unchanged |
| digests moved | `capabilities`, `list`, and codex's `info` / `inspect` / `resolve` |

Every moved digest is explained by the three `feat` catalog commits, including the `mise` method removed from codex by #661. `update` is absent from that set, confirming #668 returned it exactly. No v1 surface is removed, so a minor is correct rather than convenient.

**The governance change, and what it is not.** `pr-body-policy` rejected *any* process-only PR carrying `Release-As`, so a PR whose only purpose is moving the release boundary had nowhere to live — by definition it has no product change to attach the footer to. The repository documents `Release-As` as the one-shot mechanism in the release runbook while making that shape unreachable. This allows it when the declared major is at or below the current released major, and keeps everything else rejected: a release-worthy title, a `BREAKING CHANGE` footer, or a higher major on a process-only PR all still fail, and validation fails closed when the current major cannot be read. So a documentation PR can never reach the deferred major. Four cases are covered in `test/pr-body-policy.test.ts`.

**This PR does not depend on that allowance.** It edits `scripts/ci/pr-body-policy.ts`, so `classifyChangedFiles` reports it as product-impacting and the process-only rule never applies to it. I could have shipped the one-shot without touching governance. The rule is fixed because the gap is real and recurs the next time a stale marker sits in the range — not because this release needed it.

**After merge**, release-please should replace #669 with a `1.11.0` Release PR that passes `governance`. Tasks 5.5 through 5.7 of the OpenSpec change stay unticked until that, the tag, and the publication are confirmed, so the change is not archive-eligible yet.

