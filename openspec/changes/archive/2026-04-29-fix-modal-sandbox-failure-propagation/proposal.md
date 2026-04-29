# Proposal: Fix Modal sandbox failure propagation

## Summary

Fix the Modal-backed sandbox validation so failures inside the remote lifecycle smoke command make `bun run test:sandbox` and the dedicated GitHub Actions workflow fail reliably.

## Motivation

The dedicated sandbox workflow surfaced a remote `adopt-preinstalled` failure after the CI agent list changed from `qoder` to `opencode`, but the GitHub Actions job still completed successfully. That means the Modal CLI invocation did not propagate the remote command's failing exit status to the local runner, which breaks the workflow's value as a lifecycle validation gate.

The same run also showed that the lifecycle smoke script lacks a package mapping for `opencode` in the preinstalled-agent adoption scenario.

## Goals

- Ensure `bun run test:sandbox` exits non-zero when the remote lifecycle smoke command fails.
- Preserve useful Modal stdout/stderr in local and CI logs.
- Add `opencode` support to the preinstalled-agent adoption smoke scenario.
- Keep the Modal workflow separate from merge-gating `ci.yml`.

## Non-Goals

- Make Modal sandbox tests required for every PR.
- Change the default local Docker smoke target list.
- Broaden Quantex into a workflow orchestration system.
