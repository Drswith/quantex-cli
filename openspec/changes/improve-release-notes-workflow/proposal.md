## Why

Release-please correctly materializes versions, but the post-v0.29 lifecycle refactor exposed a release-note gap: `refactor` commits were hidden, and the repository-local resolver ignored a valid `Release-As` footer unless the commit was artificially marked as a breaking `feat!`. That made the generated release page sparse and misleading.

Future releases need one durable, reviewable path that keeps release-please as the source of version calculation while making user-facing change summaries complete and accurate.

## What Changes

- Treat a one-shot `Release-As: <version>` footer as an explicit release-please trigger in the protected-branch resolver; it MUST NOT require a misleading `feat!` or `BREAKING CHANGE` marker solely to enter Release PR mode.
- Configure release-please to show `refactor` entries in generated stable and beta changelogs, alongside its existing user-facing change categories.
- Require release-worthy source PRs to provide a concise release summary through release-please's supported commit-override format, so the generated changelog and GitHub Release use intentional user-facing text rather than incidental implementation wording.
- Update the PR template, local policy checks, release workflow contract, and release runbook. Historical version notes and already-published artifacts are out of scope.

## Capabilities

### New Capabilities

- `release-note-input`: Defines the validated source-PR metadata that release-please consumes as a user-facing release entry.

### Modified Capabilities

- `release-workflow`: Release trigger classification and generated changelog content gain explicit `Release-As` and visible-refactor behavior.
- `release-governance`: Release-worthy source PRs gain required, validated release-note metadata.

## Impact

- Affected systems: `scripts/release-target-resolution.ts`, `scripts/pr-body-policy.ts`, release-please stable/beta configuration, PR template, release runbook, and release-policy tests.
- No CLI command, package/binary identity, existing tag, npm artifact, or historical release page is changed.
