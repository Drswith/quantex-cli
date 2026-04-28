# ADR 0005: Keep AGENTS.md as a Thin Execution Handbook

- Status: Accepted
- Date: 2026-04-28

## Context

`AGENTS.md` is injected into every coding-agent session that starts in this repository. That makes it a high-leverage document, but also a poor place to maintain large snapshots of content that changes frequently, such as source trees, copied type definitions, and command tables.

As Quantex has added intake and closure gates, `AGENTS.md` has become more important for immediate execution behavior. At the same time, copied reference material inside the file has become more likely to drift away from the real source files, CLI discovery surfaces, and canonical docs.

## Decision

Quantex keeps `AGENTS.md` as a thin but self-contained execution handbook.

- Inline only the content that must influence agent behavior immediately: mission, non-goals, quickstart, hard constraints, validation triggers, intake and closure gates, file-scoped red lines, and trigger-based pointers.
- Route volatile or detailed knowledge to source-of-truth artifacts in `src/`, `openspec/`, `docs/`, or CLI discovery commands such as `quantex commands` and `quantex schema`.
- Do not use `AGENTS.md` as a copied directory tree, type reference, command catalog mirror, or product README substitute.

## Consequences

- Agents see the highest-priority execution rules with less noise at session start.
- Drift-prone content moves back to the artifacts best suited to keep it current.
- Contributors need to maintain clear pointer targets in source files and docs instead of relying on one oversized handbook.
- Some context that was previously one scroll away in `AGENTS.md` now requires following a pointer, so the pointer language must stay explicit.

## Alternatives Considered

- Keep expanding `AGENTS.md` as a self-contained mega-handbook.
- Replace `AGENTS.md` with a thin directory of links and rely on agents to expand every reference.
- Move all agent guidance into OpenSpec-generated files and remove most project-specific repository instructions.

## Follow-up

- Rewrite `AGENTS.md` to match the thin-handbook shape.
- Update any inaccurate references that still describe `AGENTS.md` as an architecture or command dump.
- Keep the handbook rule synchronized with the `project-memory` OpenSpec capability.
