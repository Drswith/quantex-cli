# Proposal: Narrow sandbox workflow push triggers

## Summary

Restrict the dedicated Modal sandbox workflow so protected-branch documentation-only or OpenSpec archive-only merges do not trigger expensive remote lifecycle smoke runs.

## Motivation

The sandbox workflow validates real agent lifecycle behavior through Modal. It is useful when lifecycle code, agent definitions, sandbox scripts, package metadata, or the workflow itself changes, but it is noisy and wasteful for docs-only or archive-only merges.

The workflow should remain manually runnable and scheduled so maintainers can still validate the remote path on demand and catch upstream drift.

## Goals

- Keep `workflow_dispatch` and the weekly schedule.
- Keep protected-branch `push` triggers for lifecycle-sensitive changes.
- Avoid automatic sandbox runs for docs-only and OpenSpec archive-only merges.
- Document the trigger boundary in the code quality tooling spec.

## Non-Goals

- Move sandbox validation into merge-gating `ci.yml`.
- Make Modal sandbox validation required for every pull request.
- Replace local Docker isolation validation.
