# Proposal: finish-governance-followups

## Why

Three open items remain from the structure and CI governance audit recorded in `docs/sessions/2026-08-05-project-structure-audit.md`. They are independent of each other but all change workflow triggers, so they land together rather than as three PRs conflicting over the same two files.

**The beta channel publishes versions older than stable.** `origin/beta` is frozen at `1.8.2-beta` while `main` is past `1.8.6`, so `npm install quantex-cli@beta` resolves strictly below `@latest`. Three defects compound: the channel cuts a prerelease *of an already-shipped stable* (`v1.8.2-beta` was tagged 59 minutes before `v1.8.2`), so by SemVer precedence it sorts below its own release and is behind by construction; nothing is pushed to `beta`, so release-please has produced exactly one release there since 2026-08-04; and both channels key package `.` against the same `.release-please-manifest.json`, so the two cannot hold independent versions without a merge that clobbers the very files recording them. That last defect is why the branch froze rather than merely lagging.

**CI has no concurrency group.** `ci.yml` fires on `pull_request` type `edited`, so every title or body edit starts a full run including the three-platform matrix, and nothing cancels the superseded one. All three release workflows declare a group; the two that run most often do not.

**`sandbox-tests` costs a run per pull request and has never gated anything.** It is advisory by design, fork PRs skip it for lack of secrets, and its recent failures were all external Modal capacity rather than repository regressions.

**`AGENTS.md` restates what it says it delegates.** Its own red lines say the full gate text lives only in the runtime skill and that only triggers belong inline, but the validation-routing matrix and the OpenSpec intake signal list appear in full in both files, with nothing checking that they agree.

## What Changes

- **Retire the standing beta branch and publish prereleases from `main`.** The release identity contract currently derives the target branch from the version shape (`prerelease ? 'beta' : 'main'`); it will always resolve to `main`, while the npm dist-tag continues to derive from the version so a prerelease still publishes to `@beta`. A preview is then cut by declaring `Release-As: <next-version>-beta.N` on a source PR, which previews the *next unreleased* version and therefore always sorts above `@latest`. `release-please-config.beta.json` is deleted, `beta` is removed from every workflow trigger and branch allowlist, and the release PR title pattern accepts prerelease versions on `main`.
- **Add concurrency groups** to `ci.yml` and `sandbox-tests.yml`, keyed on the pull request number or ref, cancelling superseded runs.
- **Move `sandbox-tests` off per-pull-request triggering** to its schedule and manual dispatch, keeping it advisory and keeping its coverage where it is actually read.
- **Compress the `AGENTS.md` validation and intake blocks to triggers**, matching what the file already does for PR body governance, and extend `memory:check` so the runtime skill must carry the routing detail that `AGENTS.md` points at.

Not included: the frozen `v1.8.2-beta` git tag and the npm `beta` dist-tag it published. Removing or repointing a published dist-tag is a registry action for a maintainer, not a repository change.

## Capabilities

- **Modified Capabilities**:
  - `release-workflow` — the beta branch ceases to be a release channel; prereleases are cut from `main` and keep publishing to the `beta` dist-tag.
  - `code-quality-tooling` — CI and sandbox workflows gain concurrency groups; `sandbox-tests` stops running per pull request.
  - `project-memory` — `memory:check` gains a routing-parity guard between `AGENTS.md` and the runtime skill.

## Impact

- `.github/workflows/{ci,release,release-please,sandbox-tests}.yml`, `release-please-config.beta.json` (deleted)
- `scripts/release/{release-seal-contract,tag-release}.ts`, `scripts/ci/{release-pr-policy,path-taxonomy,check-project-memory}.ts`
- `AGENTS.md`, `docs/releases.md`, `docs/github-collaboration.md`, `docs/runbooks/releasing-quantex.md`
- `openspec/specs/{release-workflow,code-quality-tooling,project-memory}/spec.md`
- Tests covering release identity, tag targeting, release PR policy, path taxonomy, and project memory

No CLI behavior, structured output, agent catalog, config, or state surface changes.

## Intake classification

Durable-process and release-contract change affecting the published release channel, CI triggers, and project memory policy; OpenSpec required.
