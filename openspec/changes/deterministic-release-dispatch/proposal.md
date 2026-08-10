## Why

The `tag-release` job spends a fixed two minutes on every release waiting for a workflow run that structurally cannot appear.

After pushing `v<version>`, `tag-release` polls `release.yml` for up to `RELEASE_TAG_DISPATCH_GRACE_MS` (120s) to confirm the tag event started publication, and dispatches only when nothing started. The current release contract assumes the App-token tag push fires `on: push: tags`. Run evidence says it does not:

- `release.yml` runs for `v1.8.5` through `v1.8.10` are all `workflow_dispatch`; the only `push` runs in the workflow's history were maintainer-pushed tags from `v1.8.0` to `v1.8.4`.
- In run `31155968550` the step took 4m39s: 2m32s waiting for protected-branch CI, then the full 2m05s grace period, then `Dispatched Release workflow for v1.8.10.`

The cause is `actions/checkout`, which persists the default `GITHUB_TOKEN` as an `http.https://github.com/.extraheader` credential. Git sends that header on the first request, so the App token embedded in the push URL is never used — the URL credentials are only consulted after a `401` that never happens. GitHub therefore attributes the tag push to `GITHUB_TOKEN`, and events created by `GITHUB_TOKEN` do not start workflow runs.

Two fixes were available: set `persist-credentials: false` so the App token really authenticates the push, or stop depending on the push trigger and dispatch directly. The second is chosen: dispatch has been the actual publication path for 28 consecutive runs, while the push path has not been exercised since automation took over. Restoring an unused trigger to save the same two minutes moves the release onto a link that no recent release has proven.

This is a durable release-process contract change and therefore carries an OpenSpec change before the edits.

## What Changes

- Remove the post-push polling grace period from `tag-release` and dispatch `release.yml` at the pushed tag directly.
- Remove `ensureReleaseWorkflowTriggered`, `findReleaseWorkflowRun`, and `RELEASE_TAG_DISPATCH_GRACE_MS`.
- Amend the release-workflow contract so workflow dispatch is the declared release trigger rather than a fallback, and record why the tag event does not fire for the release bot.
- Keep `on: push: tags` in `release.yml` as the maintainer path; a duplicate run is already safe under the non-cancelling per-tag concurrency group and the existing already-published checks.
- Restore `client-id: ${{ secrets.RELEASE_APP_CLIENT_ID }}` in `release-please.yml` and `release.yml`, replacing the deprecated `app-id` input. That secret has existed since `e0ad361` (2026-04-27) and was the configured identity until the 2026-08-03/08-04 workflow rewrites incidentally reverted both call sites to `app-id: ${{ secrets.RELEASE_APP_ID }}`, which now emits a runner deprecation warning on every release job.

## Capabilities

### Modified Capabilities

- `release-workflow`: the release trigger after deterministic tagging becomes an unconditional dispatch instead of a polled fallback.

### New Capabilities

- None.

## Impact

- Affected code: `scripts/release/tag-release.ts`.
- Affected tests: `test/tag-release.test.ts`.
- Affected workflows: `.github/workflows/release-please.yml`, `.github/workflows/release.yml` (deprecated action input only).
- Affected documentation: `docs/runbooks/releasing-quantex.md`, which currently states that the App-token tag push does fire the trigger.
- No CLI behavior, structured output, agent catalog entry, config, or state format changes.
- Expected effect: roughly two minutes removed from every release, and publication starts on the path that release runs actually take.
