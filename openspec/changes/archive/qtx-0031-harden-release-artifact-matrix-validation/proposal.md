# qtx-0031: Harden release artifact matrix validation

> Migrated from `autonomy/tasks/qtx-0031-harden-release-artifact-matrix-validation.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | release |
| Depends on | qtx-0030 |
| Human review | `required` |
| Docs to update | docs/runbooks/releasing-quantex.md, docs/runbooks/release-and-self-upgrade-debugging.md |

## Historical Task Contract

# Task: Harden release artifact matrix validation

## Goal

Release validation should fail before publication if any required platform binary is missing, and the resulting patch should exercise the release-please publication path end to end.

## Context

The newly adopted release-please flow has verified the non-publishing path, but not a full patch release. A small release hardening fix provides a legitimate `fix:` change that can trigger a Release PR and publish `0.2.1` without manufacturing an empty version bump.

## Constraints

- Keep the product behavior unchanged except for stricter release artifact validation.
- Do not bypass protected `main`; use PR checks and release-please Release PRs.
- Treat the final publish as a real release, not a dry run.

## Implementation Notes

- GitHub issue: https://github.com/Drswith/quantex-cli/issues/17
- Harden `scripts/build-bin.ts` so a failed target build exits nonzero.
- Harden `src/release-artifacts/index.ts` so manifest validation requires all platform assets.
- Cover the stricter validation in `test/release-artifacts.test.ts`.
- Update release runbooks with the required asset matrix.

## Done When

- PR checks pass for the release hardening change.
- Merging the fix to `main` causes release-please to create or update a Release PR.
- Merging the Release PR publishes the next patch version to npm and GitHub Releases.
- The published GitHub Release includes npm package publication and all required binary assets.

## Verification Notes

- Fix PR: https://github.com/Drswith/quantex-cli/pull/18
- Release PR: https://github.com/Drswith/quantex-cli/pull/19
- Release workflow: https://github.com/Drswith/quantex-cli/actions/runs/24843043908
- GitHub Release: https://github.com/Drswith/quantex-cli/releases/tag/v0.2.1
- npm official registry latest: `0.2.1`
- GitHub Release assets include `manifest.json`, `SHA256SUMS.txt`, and all five platform binaries.
- npm mirror registries may lag the official npm registry; verify release publication against `https://registry.npmjs.org`.

## Non-Goals

- Changing release versioning rules.
- Adding prerelease branch support.
