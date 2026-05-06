## Why

`Co-authored-by:` trailer governance currently runs on pull request commits and protected-branch push commits. That catches direct trailers before merge, but it does not catch trailers that GitHub synthesizes into the final squash merge commit. PR #179 demonstrated the gap: PR checks passed, auto-merge completed, and the subsequent `main` push CI failed because the generated squash commit contained prohibited co-author trailers.

## What Changes

- Add PR Governance validation that rejects pull requests whose commit shape is unsafe for GitHub squash merge under the no-`Co-authored-by` policy.
- Require regular pull requests to be pre-squashed into one commit and reject known agent/bot commit authors that GitHub can re-emit as co-author trailers in the squash commit body.
- Keep protected-branch push validation as a backstop instead of the first place this failure appears.

## Capabilities

### Modified Capabilities

- `release-governance`: PR governance MUST fail before merge when a pull request is likely to produce a squash merge commit containing prohibited `Co-authored-by:` trailers.

## Impact

- Affected files: `.github/workflows/pr-governance.yml`, `scripts/`, `test/`, `openspec/specs/release-governance/spec.md`.
