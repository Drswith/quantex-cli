# ADR 0003: Require Explicit Upgrade Invocation

- Status: Accepted
- Date: 2026-04-23

## Context

Upgrade-related features are easy to grow beyond their intended scope. The legacy auto-upgrade notes explicitly rejected passive startup checks, background auto-upgrade behavior, and implicit upgrade execution from unrelated commands.

Those boundaries matter even more in an agent-led project, because future agents need a durable rule that prevents silent network activity and surprise mutations.

## Decision

Quantex requires upgrades and update checks to be explicitly invoked by the user.

- Upgrade network activity belongs in commands such as `quantex upgrade`, `quantex upgrade --check`, `quantex update`, `quantex update --all`, and `quantex doctor`.
- Quantex does not perform passive startup checks on ordinary command execution.
- Quantex does not trigger upgrades automatically from unrelated commands such as agent launch flows.

## Consequences

- Users keep clear control over when network access and version checks happen.
- CI, scripts, and non-interactive usage avoid unexpected background checks.
- Future agent automation must still use explicit upgrade commands rather than hidden side effects.

## Alternatives Considered

- Passive startup version checks
- Automatic upgrade execution during command dispatch
- A configurable auto-check mode enabled by default
