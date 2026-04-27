# qtx-0011: Add version cache and network controls for upgrade checks

> Migrated from `autonomy/tasks/qtx-0011-add-version-cache-and-network-controls.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `medium` |
| Area | self |
| Depends on | qtx-0010 |
| Human review | `required` |
| Docs to update | openspec/specs/self-upgrade/spec.md |

## Historical Task Contract

# Task: Add version cache and network controls for upgrade checks

## Goal

Control version-check cost and reliability with explicit caching and network policy inputs.

## Context

The legacy auto-upgrade backlog treats ETag caching, retries, and timeouts as release-grade hardening work after manifest support.

## Constraints

- Do not let broken responses poison the cache.
- Keep behavior compatible with explicit check and upgrade commands only.

## Implementation Notes

- Add ETag plus TTL caching for version metadata.
- Configure timeout, retries, and cache TTL.

## Done When

- Version checks can reuse cached metadata safely.
- Network policy is configurable and cache writes only occur on valid responses.

## Non-Goals

- Background polling or daemonized update checks.
