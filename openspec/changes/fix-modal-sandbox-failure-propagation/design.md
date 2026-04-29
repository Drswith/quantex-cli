# Design: Fix Modal sandbox failure propagation

## Current behavior

`scripts/test-sandbox.ts` spawns `modal shell` with inherited stdio and exits with the Modal process exit code. The observed GitHub Actions run showed that a Bun exception inside the remote command was printed to the log while the local Modal process still exited successfully.

## Proposed behavior

Wrap the remote shell command with an explicit exit-code marker:

1. Run the existing remote command with `set +e` around the wrapped command.
2. Capture `$?`.
3. Print a stable marker containing that status.
4. Exit the remote shell with the same status.

`scripts/test-sandbox.ts` will capture Modal stdout/stderr, mirror them to the local process, parse the last marker, and fail when the marker is missing or non-zero. This makes the local script independent of whether the installed Modal CLI propagates the remote command status correctly.

## Alternatives Considered

- Use Modal CLI exit code only: rejected because the failure already demonstrated that it can be misleading for this command shape.
- Move sandbox tests into merge-gating CI: rejected because the existing product decision keeps Modal validation in a separate workflow.
- Remove `adopt-preinstalled` from expanded remote agent runs: rejected because preinstalled-agent adoption is one of the lifecycle edges the sandbox layer is intended to catch.
