## Why

Quantex now routes cross-agent session behavior through Superpowers and the central runtime skill. Keeping checked-in per-agent skill mirrors for Claude, Cursor, Gemini, and OpenCode creates another drift surface for workflow rules that already have a canonical source.

## What Changes

- Remove checked-in agent-specific `quantex-agent-runtime` skill bootstrap mirrors under `.claude/`, `.cursor/`, `.gemini/`, and `.opencode/`.
- Keep `skills/quantex-agent-runtime/SKILL.md`, `AGENTS.md`, and `openspec/README.md` as the canonical repository workflow entry points.
- Keep Codex environment setup metadata for hosted Codex workspace provisioning.
- Clarify that repository-owned durable workflow rules must live in the central runtime/OpenSpec artifacts, while agent-specific generated or local integration files are not authoritative workflow contracts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: durable agent-session workflow ownership is narrowed to the central runtime, OpenSpec, and canonical docs instead of checked-in per-agent skill mirrors.

## Impact

- `.claude/skills/quantex-agent-runtime/SKILL.md`
- `.cursor/skills/quantex-agent-runtime/SKILL.md`
- `.gemini/skills/quantex-agent-runtime/SKILL.md`
- `.opencode/skills/quantex-agent-runtime/SKILL.md`
- `.codex/environments/environment.toml`
- `openspec/specs/project-memory/spec.md` via this change delta
