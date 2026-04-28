## Context

`AGENTS.md` currently succeeds at surfacing hard workflow rules such as the intake gate and delivery closure gate, but it also carries content that drifts quickly: a copied source tree, copied type definitions, command catalog snapshots, and detailed config/state notes. That increases prompt weight and makes the highest-priority rules less obvious to agents at session start.

The repository already has better homes for the volatile material: source files for types and defaults, `quantex commands` and `quantex schema` for command discovery, OpenSpec for durable behavior contracts, and `docs/` for workflow and release context.

## Goals / Non-Goals

**Goals:**

- Keep `AGENTS.md` self-contained for the rules that must influence agent behavior immediately.
- Replace drift-prone inline reference material with trigger-based pointers to source-of-truth artifacts.
- Promote the discussion outcome into issue, session, ADR, and OpenSpec artifacts so the rationale does not live only in GitHub Discussion.
- Keep the resulting workflow compatible with the current OpenSpec and GitHub-native collaboration flow.

**Non-Goals:**

- Change Quantex runtime behavior or CLI contracts.
- Replace `AGENTS.md` with a link-only index that depends on agents always expanding references.
- Add new repo-local workflow commands or automation just to manage handbook content.

## Decisions

- Keep hard constraints inline inside `AGENTS.md`.
  Rationale: the intake gate, validation triggers, closure gate, and non-goals are the content most likely to affect immediate agent behavior.
- Remove copied trees, copied types, and full command tables from `AGENTS.md`.
  Rationale: those sections drift quickly and already have stronger sources of truth elsewhere in the repo or CLI.
- Use trigger-based pointers instead of a generic links section.
  Rationale: "when X, consult Y" is easier for agents to operationalize than a flat list of documentation links.
- Record the decision as an ADR and summarize the discussion in `docs/sessions/`.
  Rationale: the issue tracks executable work, but the rationale and durable direction also need repo-native memory.
- Limit collateral updates to references whose wording would become inaccurate after the handbook rewrite.
  Rationale: keep the change focused and avoid turning a handbook trim into a broad documentation rewrite.

## Risks / Trade-offs

- Risk: over-thinning `AGENTS.md` could hide rules agents need without loading other files.
  Mitigation: keep mission, gates, validation, red lines, and quickstart inline.
- Risk: pointer targets may still drift or be too broad.
  Mitigation: point to specific source files, command discovery surfaces, and canonical docs instead of generic directory roots when possible.
- Risk: some contributors may rely on `AGENTS.md` as an architecture dump.
  Mitigation: keep architecture-adjacent pointers in the handbook and leave durable details in `README`, `docs/`, OpenSpec, and source files.
