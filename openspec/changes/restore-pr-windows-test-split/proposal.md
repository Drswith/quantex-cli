## Why

PR #524 exposes a Windows-only Vitest thread-pool shutdown failure after every test file passes. The repository's documented CI policy intentionally keeps pull-request feedback responsive by building on Windows but reserves the full Windows suite for protected-branch and scheduled confidence runs; the current workflow no longer follows that policy.

## What Changes

- Restore the documented CI split: Windows pull-request jobs install and build but do not run the full Vitest suite.
- Keep the existing Windows check context and retain full Windows tests for `main`/`beta` pushes, manual dispatches, and scheduled CI.
- Update the focused workflow contract test to prevent an accidental return to full Windows PR tests.

## Capabilities

### New Capabilities

- `ci-platform-coverage`: Platform-specific CI coverage that preserves required Windows confidence without coupling every pull request to the full Windows test runtime.

### Modified Capabilities

- None.

## Impact

- `.github/workflows/ci.yml`
- `test/workflow-classification.test.ts`
- GitHub Actions merge-gating and protected-branch coverage only; no CLI, SDK, registry, or release behavior changes.
