## Why

This change modifies repository merge governance for commit metadata, so it requires OpenSpec before implementation.

Quantex previously accepted merged history containing `Co-authored-by` trailers that did not match the project's intended authorship policy. The repository currently has no remote enforcement for this metadata, so local tool defaults, IDE integrations, or bot-generated commits can introduce trailers that are only discovered after merge. That makes history cleanup expensive and can break release lineage when remediation requires force-pushing protected branches.

## What Changes

- Add a CI-governed repository script that rejects new commits containing `Co-authored-by:` trailers.
- Run that script for both pull requests and protected-branch pushes using the commits reported by GitHub for the event payload.
- Document the new commit-metadata governance rule in the release-governance specification.

## Capabilities

### Modified Capabilities

- `release-governance`: protected-branch CI now enforces repository commit metadata policy for new commits.

## Impact

- Affected code: `scripts/`, `test/`, and `.github/workflows/ci.yml`.
- Affected specs: `openspec/specs/release-governance/spec.md`.
- New pull requests and protected-branch pushes will fail before merge or release if their newly introduced commits contain `Co-authored-by:` trailers.
