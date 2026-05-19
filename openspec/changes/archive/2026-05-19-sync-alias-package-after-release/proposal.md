## Why

Quantex publishes `quantex-cli` as the primary npm package while `quantex` is an alias package maintained in a separate repository. The release workflow needs a durable handoff so a successful `quantex-cli` publish can trigger the alias repository to publish the same version.

## What Changes

- Add a post-npm-publish release workflow step that sends `repository_dispatch` to `Drswith/quantex`.
- Include the published `quantex-cli` semver version without a leading `v` in the dispatch payload.
- Send `npm_tag=latest` for stable releases and `npm_tag=next` for prereleases.
- Keep alias package publishing owned by the `quantex` repository; `quantex-cli` only sends the notification.
- Use the `QUANTEX_SYNC_TOKEN` secret for the GitHub API call.
- Skip the alias synchronization dispatch without failing the release when `QUANTEX_SYNC_TOKEN` is not configured.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: the publish phase must notify the alias package repository after `quantex-cli` npm publishing succeeds.

## Impact

- Affected workflow: `.github/workflows/release.yml`.
- Affected docs/specs: `openspec/specs/release-workflow/spec.md` via this change delta.
- External dependency: optional repository secret `QUANTEX_SYNC_TOKEN` with sufficient permission to dispatch events to `Drswith/quantex`.
