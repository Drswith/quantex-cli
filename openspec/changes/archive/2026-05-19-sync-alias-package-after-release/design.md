## Context

The `Release` workflow publishes `quantex-cli` to npm from protected-branch release commits after release-please creates the GitHub Release, builds artifacts, and validates the package. The `quantex` alias package is maintained in `Drswith/quantex` and exposes its own `repository_dispatch` entry point for synchronized publishing.

## Goals / Non-Goals

**Goals:**

- Notify `Drswith/quantex` only after the `quantex-cli` npm publish step succeeds.
- Send the released `quantex-cli` version without a leading `v`.
- Send `latest` for stable alias publishes and `next` for prerelease alias publishes.
- Fail the release workflow if the dispatch API call is rejected, so maintainers see alias synchronization problems.

**Non-Goals:**

- Do not publish the `quantex` alias package from this repository.
- Do not add a repository-local workflow wrapper for dispatching.
- Do not change the existing `quantex-cli` npm publish tag behavior.

## Decisions

- Place the dispatch step immediately after `Publish npm package`. GitHub Actions step ordering already guarantees it only runs when prior release validation and npm publish succeeded.
- Derive `version` from `steps.release.outputs.tag_name` by removing a leading `v`, matching the tag created by release-please while satisfying the alias repository payload contract.
- Derive the alias payload tag from the semver version: versions containing `-` are prereleases and dispatch `npm_tag=next`; all others dispatch `npm_tag=latest`.
- Use `curl --fail-with-body` with `QUANTEX_SYNC_TOKEN` so API failures stop the release job with visible response details.

## Risks / Trade-offs

- Missing or under-permissioned `QUANTEX_SYNC_TOKEN` -> the primary `quantex-cli` package will already be published, but the workflow will fail before artifact upload and require maintainer intervention.
- GitHub API outage after npm publish -> the alias sync notification can fail independently of primary publish; rerunning the release workflow should retry the dispatch for the same release target.
