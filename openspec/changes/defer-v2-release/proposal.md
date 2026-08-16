## Why

The desktop client was added after `v1.10.0` and then removed before another release, but the revert commit carries breaking-change metadata. Release Please therefore keeps proposing `2.0.0` even though the required v2 refactor has not completed its 90-day stabilization period. Closing each generated PR is temporary: another push to `main` recreates it.

The current generic major-version check is also insufficient. It rejects an undeclared major Release PR, but it still lets the ineligible PR remain open and can be bypassed by adding `Release-As: 2.0.0` to the PR body.

Work intake classification: this changes the durable release workflow and publication contract, so an OpenSpec change is required before implementation.

## What Changes

- Pause automatic Release PR creation while the temporary v2 readiness gate is active, so pushes to `main` do not recreate a dangling `2.0.0` PR.
- Add one shared deny-by-default readiness rule for stable `2.x` versions.
- Enforce that rule in generated Release PR validation, deterministic tag planning, and immutable publication identity validation.
- Require a future reviewed OpenSpec change to record the completed v2 refactor and at least 90 days of stabilization evidence before the temporary gate can be removed.
- Document the temporary release freeze and its recovery path without changing the published `v1.10.0` release.

## Capabilities

### New Capabilities

- `major-release-readiness`: Prevent preparation, tagging, and publication of stable v2 while its refactor and stabilization requirements remain unsatisfied.

### Modified Capabilities

- `release-workflow`: Automatic Release PR preparation may be paused by a repository-recorded deferred-major gate, and a generic maintainer declaration cannot override that gate.

## Impact

Affected areas are the Release Please workflow, Release PR policy, tag planner, publication identity contract, focused release tests, release documentation, and OpenSpec contracts. No tag, GitHub Release, npm package, or source version is created, moved, or deleted by this change.
