# ADR 0002: Keep Self-Upgrade and Agent Update as Separate Subsystems

- Status: Accepted
- Date: 2026-04-23

## Context

Quantex exposes one user-facing upgrade surface, but it covers two different concerns:

- Quantex CLI self-upgrade
- installed agent updates

The legacy auto-upgrade scope notes made a useful distinction between these areas, but the distinction was only captured in root markdown notes and not in canonical project memory.

## Decision

Quantex keeps self-upgrade and agent update as separate subsystems.

- Self-upgrade owns Quantex CLI install-source inspection, version checks, execution, verification, and recovery hints.
- Agent update owns agent install-source inspection, version probes, single-agent updates, batch planning, and manual fallback hints.
- Shared behavior is limited to user-facing command style, diagnostics style, and reusable low-level utilities.

Quantex does not introduce a unified abstraction that models the CLI itself as a special agent.

## Consequences

- The self-upgrade path can preserve its stricter safety and recovery model.
- Agent update can evolve around package-manager and agent-specific strategies without polluting self-upgrade.
- Shared utilities remain possible, but business semantics stay isolated.
- Future refactors should avoid cross-subsystem enums or plan types unless they are genuinely tool-level and semantics-free.

## Alternatives Considered

- A single "upgradable target" abstraction for Quantex and agents
- Treating self-upgrade as one more agent definition
- Leaving the boundary implicit in design notes only
