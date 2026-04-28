## Why

The current governance prevents documentation-only PRs from accidentally using release-worthy metadata, but it does not prevent product-impacting PRs from being squash-merged with `docs:` or `chore:` and silently skipping release automation.

## What Changes

- Add a release-intent gate to PR Governance for product-impacting files.
- Require PR bodies to include a `## Release Intent` section.
- Allow product-impacting PRs to either use release-worthy conventional metadata or explicitly state that release is not applicable with a reason.
- Keep release-please generated Release PRs compatible with the updated PR body requirements.
- Do not change release-please version calculation or publish behavior.

## Capabilities

### New Capabilities

- `release-governance`: Defines PR-level release intent checks that reduce accidental release skips.

### Modified Capabilities

- None.

## Impact

- Affected files: `.github/workflows/pr-governance.yml`, `.github/pull_request_template.md`, `release-please-config.json`, `release-please-config.beta.json`, `openspec/changes/enforce-release-intent/*`.
- No CLI runtime behavior, dependency, package artifact, or publish-step change.
