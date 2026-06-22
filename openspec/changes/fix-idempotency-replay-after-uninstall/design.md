## Context

Idempotency records are keyed by client-supplied `--idempotency-key` values and replay successful results without re-executing command work. `uninstall` clears agent state but does not remove unrelated idempotency files, so install/ensure/update successes can be replayed after the agent is gone.

## Goals / Non-Goals

- Goals: prevent false-success replay when agent presence no longer matches the stored lifecycle result.
- Non-Goals: redesign idempotency storage, add per-agent indexes, or change Windows deferred self-upgrade semantics in this change.

## Decisions

- Validate stored results at replay time instead of scanning and deleting idempotency files during `uninstall`.
  - Rationale: one narrow guard covers uninstall, manual removal, and external package-manager cleanup without coupling lifecycle commands to idempotency storage layout.
- For `install`, `ensure`, and `update` with agent targets, require every named agent to be in `PATH` before replaying a stored success.
- For `uninstall` with agent targets, require every named agent to be absent from `PATH` before replaying a stored success.
- Leave unrelated actions and non-agent targets unchanged.

## Risks / Trade-offs

- Replay adds one inspection lookup per named agent. This is acceptable because idempotent retries are already rare and correctness matters more than saving a PATH probe.
