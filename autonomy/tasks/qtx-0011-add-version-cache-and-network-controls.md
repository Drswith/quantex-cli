---
id: qtx-0011
title: Add version cache and network controls for upgrade checks
status: planned
priority: medium
area: self
depends_on:
  - qtx-0010
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/self-upgrade/spec.md
---

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
