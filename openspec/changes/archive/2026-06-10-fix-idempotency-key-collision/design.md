## Context

Idempotency records live under `~/.quantex/idempotency/` as one JSON file per client key. The current sanitizer maps many distinct strings to the same filename.

## Goals / Non-Goals

- Goals: make on-disk filenames injective for client-supplied keys; keep TTL and replay semantics unchanged for non-colliding keys.
- Non-Goals: migrate legacy sanitized filenames, change replay action-matching rules, or alter idempotency TTL.

## Decisions

- Use SHA-256 hex digest of the UTF-8 key as the filename stem. This is deterministic, filesystem-safe, and collision-resistant for practical key lengths.
- Do not embed the raw key in the filename to avoid path-length and character-set issues.

## Risks / Trade-offs

- Existing records written under sanitized filenames become unreachable after upgrade. Acceptable because records expire after 24 hours and collisions were already unsafe.

## Migration Plan

- None. Old sanitized files age out naturally.
