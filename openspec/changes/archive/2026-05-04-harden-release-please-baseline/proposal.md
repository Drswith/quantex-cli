## Why

Implementation requested work-intake classification: this change modifies release workflow governance and durable release metadata handling, so it requires OpenSpec before file edits.

Quantex's release automation produced a duplicate `chore: release 0.13.0` PR after `feat(agents): add deepseek tui support` merged to `main`. The duplicate Release PR re-summarized old history and prevented the newly merged feature from advancing to a new version. The evidence points to two workflow weaknesses:

- `release-please-config.json` still carries a stale `last-release-sha` override from April 24, 2026, so release-please can anchor changelog and version planning to an outdated baseline.
- Release PR automerge currently validates branch, title, and changed-file scope, but it does not reject a generated Release PR whose proposed version fails to advance beyond the current base-branch version.

## What Changes

- Remove the stale manifest-level release baseline override so release-please can derive the next release from the current manifest and tags instead of an outdated pinned SHA.
- Harden Release PR validation so automerge fails when a generated release PR proposes a version that is not strictly greater than the current version on the protected base branch.
- Document the baseline and monotonic-version requirements in the release workflow specification.

## Capabilities

### Modified Capabilities

- `release-workflow`: release-please baseline selection and generated Release PR validation for protected branches.
- `release-governance`: dedicated Release PR validation now enforces version advancement instead of only shape and file-scope checks.

## Impact

- Affected code: `release-please-config.json`, `.github/workflows/release-pr-automerge.yml`, and any shared validation helpers needed by that workflow.
- Affected specs: `openspec/specs/release-workflow/spec.md` and `openspec/specs/release-governance/spec.md`.
- Release output should resume producing the next version after release-worthy merges instead of duplicating an already published version.
