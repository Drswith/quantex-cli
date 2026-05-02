## Why

PR Governance validates the GitHub pull request body verbatim. Automation-created PRs often ship a short summary and omit the full template sections, which fails `pr:body:check` even when the change is legitimate and CI otherwise passes.

## What Changes

- PR Governance merges the GitHub PR body with a repository-owned governance appendix before running the shared `pr:body:check` script.
- Contributors can still paste a full template body; the appendix only fills missing governance sections when appended.

## Impact

- Affected code: `.github/workflows/pr-governance.yml`, `scripts/merge-pr-body-for-governance.ts`, `.github/pr-body-governance-appendix.md`.
- Affected contracts: `release-governance` capability (PR body validation in CI).
