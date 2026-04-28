# Session: 2026-04-28 AGENTS Handbook Discussion 68

## Context

Discussion 68 reviewed the current `AGENTS.md` and found that it mixed execution rules with product intro, architecture snapshots, copied types, and command tables. That made the file heavier for agents to ingest and increased drift risk for sections that already had stronger sources of truth elsewhere in the repository.

## Decisions

- `AGENTS.md` should remain a thin but self-contained execution handbook, not a README clone or architecture dump.
- Hard constraints stay inline: mission, non-goals, quickstart, intake gate, validation triggers, closure gate, and file-scoped red lines.
- Volatile details move behind trigger-based pointers to source files, docs, and discovery commands.
- The discussion outcome should be promoted into repo-native memory and executable workflow artifacts instead of living only in GitHub Discussion.

## Open Questions

- None at the time of summary.

## Follow-up

- GitHub issue created: `#70`
- OpenSpec change created: `trim-agents-handbook`
- ADR added: `docs/adr/0005-keep-agents-as-a-thin-execution-handbook.md`
