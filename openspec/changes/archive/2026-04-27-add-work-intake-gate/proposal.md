## Why

Recent implementation work showed that agents can interpret “start implementation until complete” as code-only completion and skip the project’s OpenSpec/spec workflow until corrected. The workflow needs an explicit intake gate that maps implementation requests to OpenSpec requirements before file edits begin.

## What Changes

- Add a durable work intake gate to project memory rules.
- Require agents to classify requested work before implementation, especially when the user asks to “start”, “implement”, “land”, or “complete” a task.
- Define concrete OpenSpec trigger categories so contract-affecting changes are not treated as small edits.
- Document allowed no-OpenSpec cases and require the agent to state that classification.
- Update project-facing guidance so Codex and other coding agents can follow the same workflow.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: Adds the intake gate that determines when OpenSpec is mandatory before implementation.

## Impact

- Affected files: `AGENTS.md`, `openspec/README.md`, `openspec/config.yaml`, and the `project-memory` OpenSpec change/spec artifacts.
- No runtime CLI behavior, package output, dependency, or release automation changes.
