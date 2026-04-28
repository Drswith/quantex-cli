## Why

Discussion 68 concluded that `AGENTS.md` has become a mixed document that combines hard execution rules with drift-prone product, architecture, type, and command snapshots. Because the file is injected into every agent session, the project needs a thinner, higher-signal handbook that keeps critical constraints inline and routes volatile details to source-of-truth artifacts.

Work-intake classification: this is a durable-process and project-memory change, so OpenSpec is required before implementation.

## What Changes

- Rewrite `AGENTS.md` into a thin but self-contained execution handbook.
- Keep mission, non-goals, quickstart, hard constraints, validation triggers, intake gate, closure gate, file-scoped red lines, and trigger-based pointers inline.
- Remove copied directory trees, copied type definitions, and full command tables from `AGENTS.md` in favor of pointers to source files, commands, or docs.
- Promote the discussion outcome into repo-native artifacts, including a session summary, ADR, GitHub issue, and OpenSpec delta.
- Update references that describe what `AGENTS.md` is responsible for so they match the thinner handbook role.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: Adds a durable requirement that `AGENTS.md` stays a thin execution handbook with trigger-based pointers to volatile source-of-truth details.

## Impact

- Affected files: `AGENTS.md`, `README.md`, `README.en.md`, `docs/sessions/`, `docs/adr/`, and the `project-memory` OpenSpec change/spec artifacts.
- GitHub collaboration artifacts: issue `#70` promoted from discussion `#68`.
- No runtime CLI behavior, dependency, or release automation changes.
