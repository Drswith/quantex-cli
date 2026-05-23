# Design

## Approach

Keep `skills/quantex-agent-runtime/SKILL.md` as the canonical contributor runtime. The new `.agents/skills/quantex-agent-runtime/SKILL.md` remains a short bootstrap that tells agents to activate Superpowers when available and then read the central runtime, `AGENTS.md`, and `openspec/README.md`.

Removing `.superset/config.json` narrows repository-maintained setup guidance to the existing Quantex runtime, OpenSpec, and validation commands.

## Risks

- Some agent runtimes may still need agent-specific bootstrap directories. This change does not remove those directories.
- A future cleanup may decide whether other bootstrap directories should be generated or retained, but that is outside this change.
