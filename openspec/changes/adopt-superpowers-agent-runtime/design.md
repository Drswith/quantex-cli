## Context

The repository currently distributes OpenSpec workflow behavior through several layers:

- `AGENTS.md` carries the hard execution rules.
- `openspec/README.md` and `openspec/config.yaml` describe the official change workflow.
- `.claude/`, `.cursor/`, `.gemini/`, `.codex/`, `.opencode/`, and `.github/skills/` contain generated OPSX command or skill copies.
- `.github/workflows/openspec-archive.yml` performs post-merge archive closure by creating and auto-merging archive PRs.

This helped bootstrap discipline, but it made workflow behavior live in too many places. Superpowers is better suited to the cross-agent behavior layer because it gives coding agents composable skills for session startup, brainstorming, worktrees, plans, review, verification, and finishing branches. Quantex can then keep durable knowledge in OpenSpec/docs while reducing duplicated agent-specific workflow files.

## Goals / Non-Goals

**Goals:**

- Make Superpowers the preferred runtime for agent session behavior in Quantex.
- Keep OpenSpec as the source of truth for non-trivial change contracts.
- Replace copied OPSX skills/commands with a central Quantex runtime skill and thin agent bootstraps.
- Move OpenSpec archive closure out of GitHub bot orchestration and into explicit agent-driven delivery closure.
- Preserve CI as the required enforcement surface for validation.

**Non-Goals:**

- Do not vendor the entire Superpowers upstream repository into Quantex.
- Do not require product users of `quantex` to install Superpowers.
- Do not move release artifact generation, package validation, or GitHub required checks into agent skills.
- Do not remove OpenSpec.

## Decisions

### Decision: centralize Quantex-specific workflow in one runtime skill

Add `skills/quantex-agent-runtime/SKILL.md` as the Quantex-specific Superpowers project skill. It will define the session-start, intake, implementation, validation, artifact-routing, and delivery-closure requirements for this repo.

Why this over keeping generated OPSX copies:

- The generated OPSX files repeat similar instructions across every agent directory.
- A central skill is easier to review and evolve.
- Superpowers already provides the meta-workflow discipline; Quantex should only add project-specific constraints.

### Decision: keep only thin agent bootstraps

Agent-specific directories will no longer carry full OPSX apply/archive/explore/propose copies. They will contain only minimal bootstrap files that tell the agent to activate Superpowers and read the central Quantex runtime skill.

Why this over deleting all agent directories:

- Different agents still discover project instructions through different paths.
- Thin bootstraps preserve cold-start discoverability without duplicating workflow logic.

### Decision: retire archive bot automation

Remove the OpenSpec archive workflow and helper script. Archive closure will become part of the Superpowers-driven finishing process: after implementation merge, an agent resumes, syncs accepted spec deltas, runs validation, archives the change, and opens the archive PR if needed.

Why this over keeping the bot:

- The bot created extra PR churn and hid part of the lifecycle behind automation that was itself governed by the same workflow.
- Archive closure is a project-memory operation, not a product build step.
- Superpowers is being adopted specifically to make any fresh agent session able to resume and close this kind of work reliably.

### Decision: keep machine-enforced validation in Actions and scripts

Release artifacts, binary builds, package checks, required contexts, and publishing remain repository scripts or GitHub Actions.

Why this over migrating them:

- These are deterministic machine gates, not agent behavior.
- Moving them into skills would make enforcement depend on agent compliance rather than CI.

## Risks / Trade-offs

- [Agents without Superpowers installed may miss the runtime] -> Keep `AGENTS.md` and thin bootstraps as fallback instructions with explicit Superpowers setup pointers.
- [Archive closure becomes less automatic] -> Make archive closure a required delivery state in the central runtime and docs; CI still validates OpenSpec when archive PRs are created.
- [Generated OPSX update path is no longer direct] -> Treat upstream OpenSpec CLI as the command source and Superpowers as the behavior source; regenerate OPSX only if the strategy changes again.
- [Large deletion makes review harder] -> Keep product code untouched and separate this change from release/build script changes.
