# Proposal: fix-release-tag-automation

## Why

Manually merged release-please Release PRs (rebase/squash by maintainers after re-authoring) do not receive an automatic `v<version>` tag. The next `release-please` run aborts with "untagged, merged release PRs outstanding", blocking future Release PRs until a human pushes the tag.

## What Changes

- Add a tag backstop job after `release-please` on protected-branch push.
- When branch head is a `chore: release <version>` commit, manifest version has no tag, and push CI succeeded, create the tag and relabel the merged release PR from `autorelease: pending` to `autorelease: tagged`.
- Document the automatic path in `docs/releases.md` and trim stale Seal references in the releasing runbook.

## Capabilities

- `release-workflow` (modify)

## Impact

- `.github/workflows/release-please.yml`
- `scripts/release-tag-backstop.ts` (new)
- `package.json` (`ci:release-tag-backstop`)
- `test/release-tag-backstop.test.ts`
- `openspec/specs/release-workflow/spec.md`
- `docs/releases.md`, `docs/runbooks/releasing-quantex.md`

## Intake classification

Observable release automation behavior change; OpenSpec required.
