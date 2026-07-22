## Context

Superpowers is currently named as the preferred cross-agent runtime in the central Quantex runtime skill, current entry manuals, and the `project-memory` specification. The same repository already has a central runtime skill, OpenSpec lifecycle, native GitHub and git tooling, and executable validators. Historical planning and progress Markdown under Superpowers-named paths must remain available as historical evidence.

## Goals / Non-Goals

**Goals:**

- Remove Superpowers as a prerequisite, fallback, or authoritative workflow layer from current agent guidance.
- Keep one repository-native session route: central runtime skill, `AGENTS.md`, OpenSpec, native CLIs, and repository validation.
- Preserve historical Superpowers Markdown in a single archive location without reclassifying it as active workflow guidance.

**Non-Goals:**

- Rewrite historical-record Markdown or update its historical internal references.
- Change Quantex CLI behavior or the user-facing `quantex-cli` skill's operating instructions.
- Replace OpenSpec, GitHub Actions, native CLIs, or repository validators with a new workflow framework.

## Decisions

- Replace every active Superpowers runtime instruction with repository-native wording. This preserves the existing process gates while removing environment-specific activation.
- Retain `skills/quantex-agent-runtime/SKILL.md` as the single detailed session guide; the three agent-specific copies stay short pointers. This avoids duplicated policy while supporting agent-native discovery.
- Move `docs/superpowers/plans/` to `docs/archive/superpowers/plans/` and `.superpowers/sdd/` to `docs/archive/superpowers/sdd/`, then index the archive without changing historical contents. This makes retention intentional and keeps active repository paths free of the retired workflow.

## Risks / Trade-offs

- [A future manual still names Superpowers] → Verify all non-historical Markdown, configuration, and bootstrap skills with a scoped case-insensitive search.
- [Historical documents get treated as active instructions] → State their historical-only role in the project-memory contract and leave their contents untouched.
- [Runtime guidance drifts across agents] → Keep bootstrap files as thin routes and make the central runtime the canonical detailed guide.

## Migration Plan

1. Move historical planning and SDD records into `docs/archive/superpowers/` without editing their contents.
2. Update the `project-memory` delta and current manuals together.
3. Validate OpenSpec and project-memory checks, then run the repository's documentation-required baseline checks.
4. A revert restores only current guidance; historical records are unchanged throughout.

## Open Questions

None.
