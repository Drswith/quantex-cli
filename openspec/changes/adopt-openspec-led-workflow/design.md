## Context

Quantex is itself a CLI product. The project briefly accumulated a second, repo-local CLI-like workflow for managing its own development tasks. That helped prove the value of repo-native project memory, but it also created a nested-tooling smell and made future multi-agent collaboration depend on conventions that only existed inside this repository.

OpenSpec's OPSX workflow provides the missing standard layer: agent-discoverable skills, change artifacts, status checks, artifact instructions, validation, and archiving. GitHub remains the collaboration and merge-gating surface, while OpenSpec becomes the durable change-contract surface.

## Goals / Non-Goals

**Goals:**

- Make non-trivial behavior and durable-process changes start from OpenSpec artifacts.
- Let multiple coding agents discover the same OPSX actions without relying on Codex-only instructions.
- Preserve historical `qtx-*` work without keeping the old task queue active.
- Keep validation reproducible through project-local scripts and CI.
- Keep Quantex focused on agent lifecycle CLI behavior, not project workflow orchestration.

**Non-Goals:**

- Replace GitHub issues, PRs, CI, release-please, ADRs, runbooks, postmortems, or session summaries.
- Rewrite every migrated historical task body into current OPSX wording.
- Enable every OpenSpec-supported agent integration.
- Adopt the expanded OPSX profile before the core workflow is stable.

## Decisions

- Use project-local OpenSpec CLI dependency instead of global installs.
  - Rationale: CI, local agents, and human maintainers get the same CLI version from `bun.lock`.
  - Alternative considered: rely on `bunx @latest` or global installs. That was rejected because it allows version drift.

- Initialize OPSX integrations for the agent set Quantex is most likely to use now.
  - Rationale: Codex, Claude Code, Gemini CLI, Cursor, GitHub Copilot, and OpenCode cover the expected multi-agent workflow without generating every possible vendor integration.
  - Alternative considered: `--tools all`. That was rejected because it would add many unused files and increase maintenance noise.

- Add `openspec/config.yaml` rather than encoding Quantex rules into generated skills.
  - Rationale: config is the OpenSpec-native way to inject project context and artifact rules across agents.
  - Alternative considered: copy Quantex guidance into each generated skill. That was rejected because generated files should stay upstream-owned.

- Keep `AGENTS.md` as project-level guidance.
  - Rationale: `AGENTS.md` still carries Quantex-specific architecture, commands, and release rules. OPSX files carry OpenSpec operation protocols.
  - Alternative considered: let OpenSpec generated files replace `AGENTS.md`. That was rejected because many instructions are product-specific and not OpenSpec-specific.

## Risks / Trade-offs

- Generated OPSX files add repository weight -> Limit initialization to the selected agent set and keep generated files unmodified.
- Multiple instruction systems could drift -> Put shared project context in `openspec/config.yaml` and keep `AGENTS.md` focused on Quantex-specific constraints.
- Agents may overuse OpenSpec for tiny fixes -> Keep the project-memory spec rule that small fixes may proceed through GitHub Issue/PR without an OpenSpec change.
- Archiving could be done before specs are synced -> Use `openspec status`, `openspec validate`, and human review before `openspec archive`.

## Migration Plan

1. Migrate historical `qtx-*` tasks into OpenSpec archive history.
2. Remove active autonomy scripts and queue files.
3. Pin OpenSpec CLI and add repo scripts.
4. Run `openspec init` for the selected coding agents.
5. Add project config and bring this change into OPSX artifact shape.
6. Validate locally and through CI.

## Open Questions

- Whether to enable OpenSpec's expanded OPSX profile after the core propose/apply/archive workflow has proven stable.
- Whether additional agent integrations should be added when those tools become part of the regular Quantex workflow.
