## Context

Release PR Automerge runs in `pull_request_target` and checks out the protected base branch before importing `scripts/release-pr-policy.js`. This is the right trust boundary: a generated release-please PR cannot weaken its own validator.

The accidental `1.0.0` has two separate failure modes:

- Release-please can interpret a pre-1.0 breaking change as a major bump unless configured otherwise.
- Even after the incident was recovered, npm keeps `quantex-cli@1.0.0` occupied and deprecated, so any future Release PR for the exact stable version `1.0.0` must be invalid.

## Approach

Add `bump-minor-pre-major` to the stable release-please package config. This prevents ordinary pre-1.0 breaking changes from generating `1.0.0`.

Keep an explicit validator guard in `scripts/release-pr-policy.js` because configuration drift or release-please behavior changes should still fail before automerge. The validator should:

- reject stable Release PRs that promote a zero-major base directly to `1.0.0`;
- reject stable Release PRs whose proposed version is in a small hard-coded burned-version set, currently only `1.0.0`;
- keep beta Release PR rules unchanged.

## Non-goals

- Do not reintroduce the CodeWhale catalog rename from the superseded PR.
- Do not try to unpublish npm versions from CI.
- Do not add runtime CLI behavior for burned release versions.
