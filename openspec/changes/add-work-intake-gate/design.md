## Context

The repository already uses OpenSpec for non-trivial behavior and durable-process changes, but the rule is currently framed as guidance rather than a required intake step. Coding agents can therefore move from user approval directly into code edits, especially when general coding instructions emphasize autonomy and completion.

## Goals / Non-Goals

**Goals:**

- Make OpenSpec classification an explicit pre-edit gate.
- Give agents a concrete trigger list instead of relying on subjective “non-trivial” judgment alone.
- Preserve a lightweight path for truly small fixes.
- Keep the workflow compatible with Codex, Claude Code, Gemini CLI, Cursor, GitHub Copilot, and OpenCode.

**Non-Goals:**

- Add repo-local project-management scripts or custom workflow automation.
- Require OpenSpec for every typo, formatting fix, or mechanical no-behavior edit.
- Change Quantex runtime behavior.

## Decisions

- Put the hard rule near the top of `AGENTS.md`.
  Rationale: agents read `AGENTS.md` as immediate working instructions, so the gate must appear before detailed architecture and command reference sections.
- Mirror the rule in `openspec/README.md`.
  Rationale: OpenSpec-specific documentation should explain when to use the workflow, not only how to run commands.
- Inject the rule into `openspec/config.yaml`.
  Rationale: generated OpenSpec instructions should reinforce the same trigger language when agents create artifacts.
- Add a `project-memory` spec delta instead of a new standalone capability.
  Rationale: this is a rule about how durable project memory and change contracts are created.

## Risks / Trade-offs

- Risk: agents may over-create OpenSpec changes for tiny edits.
  Mitigation: document explicit no-OpenSpec cases and require a short classification.
- Risk: agents may still skip the gate under pressure to “just implement.”
  Mitigation: state that “start/implement/until complete” wording does not bypass the gate.
- Risk: generated OPSX files may drift from project-specific rules.
  Mitigation: keep generated files upstream-like and store the project-specific rule in `AGENTS.md`, `openspec/README.md`, and `openspec/config.yaml`.
