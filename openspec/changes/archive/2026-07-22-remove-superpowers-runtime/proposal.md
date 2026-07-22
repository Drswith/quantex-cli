## Why

Quantex's current agent guidance makes Superpowers a required or preferred session dependency even though the repository's durable workflow can be expressed through the central runtime skill, OpenSpec, repository validators, and native CLIs. This creates an unnecessary environment-specific prerequisite for contributors and supported coding agents.

## What Changes

- **BREAKING** Remove Superpowers activation and runtime requirements from current Quantex agent-entry documentation, bootstrap skills, and project-memory contracts.
- Make `skills/quantex-agent-runtime/SKILL.md` the central repository-session guide without a Superpowers fallback split.
- Keep agent-specific bootstrap skills thin routes to the central runtime, `AGENTS.md`, and OpenSpec.
- Consolidate existing Superpowers historical-record Markdown under `docs/archive/superpowers/` without rewriting or deleting them.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: Replace the Superpowers-backed cross-agent runtime contract with a repository-native central runtime contract, while preserving historical records.

## Impact

- Affected current manuals include `AGENTS.md`, the central and agent-specific runtime skills, README entry prompts, OpenSpec guidance/configuration, collaboration/runbook documentation, and the historical-record archive layout.
- No Quantex CLI commands, lifecycle behavior, or user-facing `skills/quantex-cli/` operating contract changes.
