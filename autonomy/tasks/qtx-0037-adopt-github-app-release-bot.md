---
id: qtx-0037
title: Adopt GitHub App release bot
status: done
priority: high
area: release
depends_on:
  - qtx-0030
  - qtx-0035
human_review: required
checks:
  - bun run memory:check
  - bun run lint
  - bun run typecheck
docs_to_update:
  - docs/runbooks/releasing-quantex.md
  - docs/github-collaboration.md
---

# Task: Adopt GitHub App release bot

## Goal

Release automation should use a scoped GitHub App installation token instead of long-lived release bot tokens or the degraded `GITHUB_TOKEN` fallback.

## Context

The release-please Release PR flow needs a real bot identity so generated Release PRs trigger downstream checks and can be auto-merged after validation. A GitHub App gives the release system a narrow permission set and short-lived tokens without tying automation to a personal access token.

## Constraints

- Keep npm publishing on GitHub Actions trusted publishing with OIDC.
- Install the GitHub App only on the `Drswith/quantex-cli` repository.
- Give the App only the repository permissions required for release-please and Release PR automerge.
- Do not store the private key in the repository.

## Implementation Notes

- GitHub issue: https://github.com/Drswith/quantex-cli/issues/37
- Create GitHub App `quantex-cli-release-bot`.
- Store `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` as repository secrets.
- Update release workflows to use `actions/create-github-app-token`.
- Remove `RELEASE_PLEASE_TOKEN` and `RELEASE_AUTOMERGE_TOKEN` from the normal documented path.

## Done When

- The GitHub App is installed on `Drswith/quantex-cli`.
- Release workflows mint GitHub App installation tokens during execution.
- Release documentation describes the App-based identity.

## Verification Notes

- Repository secrets `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` were configured.
- Local validation passed: `bun run memory:check`, `bun run lint`, `bun run typecheck`.
- GitHub PR validation and a post-merge Release workflow run must confirm the App token works end to end.

## Non-Goals

- Changing release version calculation.
- Changing npm trusted publisher configuration.
- Granting the GitHub App administration, secrets, workflows, or all-repository access.
