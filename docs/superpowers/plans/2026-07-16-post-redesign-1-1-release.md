# Post-Redesign 1.1 Release Plan

Base: `origin/main@970328970b716e6761a18494c7e4c29055d7a83f`

OpenSpec: `graduate-post-redesign-release-line`

## Goal

Keep `0.29.1` as the final 0.x baseline and publish the completed lifecycle redesign as `1.1.0` through Quantex's protected release-please path. Do not rewrite `v0.29.1`, reuse `1.0.0`, or manually edit generated release version files.

## Task 1: Lock the graduation boundary

- Add red tests that accept only `0.29.1 -> 1.1.0` across the 0.x-to-1.x boundary.
- Reject any later 0.x proposal from `0.29.1`, burned `1.0.0`, `1.1.0` from another 0.x base, and any other 1.x graduation target.
- Prove stable release-please exits pre-major planning and contains no persistent `release-as` configuration.
- Preserve ordinary pre-`0.29.1` recovery comparisons and post-`1.1.0` SemVer progression.

## Task 2: Implement and validate

- Update only stable Release PR policy, stable release-please configuration, focused tests, OpenSpec artifacts, and canonical release guidance.
- Do not change `package.json`, `.release-please-manifest.json`, `CHANGELOG.md`, or generated build metadata in this implementation PR.
- Run the focused release/governance tests, full `--maxWorkers=2` suite, lint, format check, typecheck, OpenSpec validation, memory check, diff check, and Bun process check.
- Obtain independent review and deliver one commit with subject `feat(release)!: graduate post-redesign line` and the exact body footer:

```text
Release-As: 1.1.0
```

## Task 3: Deliver the implementation and generated release

- Validate a template-based Ready PR to `main`; keep auto-merge disabled.
- After checks pass, lock its head SHA and manually rebase-merge.
- Refresh `main` and verify the merged commit body retains exactly `Release-As: 1.1.0`.
- Require release-please to create the trusted branch PR titled `chore: release 1.1.0`; stop on any other version or file scope.
- Verify the exact graduation Release PR workflow skipped release-bot token creation and auto-merge enablement, wait for all checks, lock the release head, and manually rebase-merge.

## Task 4: Verify publication and archive closure

- Require green post-release main CI and successful formal Release workflow.
- Verify tag and GitHub Release `v1.1.0` point at the release commit, expected binaries/checksums are attached, npm exposes `quantex-cli@1.1.0`, and npm `latest` is `1.1.0`.
- Only then synchronize the accepted OpenSpec delta, run repo-native archive closure, deliver its Ready PR, manually rebase-merge, and verify archive-only workflows publish nothing further.

## Recovery

If network or quota interruption occurs, resume from the first incomplete OpenSpec task after refreshing `origin/main`, open PRs, workflow runs, GitHub Releases, npm metadata, and the local clean-tree state. Never recreate a merged implementation or Release PR, never republish an existing version, and never enable automatic merge as a recovery shortcut.
