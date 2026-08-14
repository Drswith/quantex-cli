## Why

Issue #645 exposed a release-verification blind spot: the published `install.sh` and `install.ps1` can request a different asset name from the one the release pipeline publishes, while local archive checks continue to pass. The release pipeline needs a real post-publication check that exercises the documented installers against the exact tagged GitHub Release before treating installer compatibility as closed.

Work-intake classification: non-trivial release-process and durable behavior change, so this change requires an OpenSpec contract before implementation.

## What Changes

- Add a post-publish release job with Linux, macOS, and Windows matrix legs.
- Run the exact tagged `install.sh` on Linux and macOS and the exact tagged `install.ps1` on Windows against the just-published release, using an isolated installation directory.
- Verify that each installer creates its documented entry points and that the installed executable reports the release version.
- Make a failed installer leg fail the release workflow with the installer name visible in the failure, while retaining the already-public release and requiring remediation or a same-tag rerun rather than retagging.
- Add regression coverage for the workflow wiring and document the post-publish failure and recovery policy in the release runbook.

The change does not alter installer behavior, release asset names, archive formats, supported build targets, or the existing static installer tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: require end-to-end verification of the documented standalone installers against every published CLI release.

## Impact

- `.github/workflows/release.yml` gains a post-publish cross-platform installer smoke job.
- Release workflow regression tests will pin the matrix, exact release identity, scratch install path, and failure ordering.
- `docs/runbooks/releasing-quantex.md` will describe the new gate and same-tag recovery path.
- No new runtime or package dependency is required; the check uses the existing hosted runner shells and the checked-in installer scripts.
