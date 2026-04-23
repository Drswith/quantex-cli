# Quantex Skill Installation And Distribution

This document explains how the repo-local Quantex skill is installed, validated, updated, and shared today.

## Scope

The Quantex skill is a repo-native skill for Codex and similar agents that should operate Quantex through its lifecycle CLI surface instead of calling downstream agent binaries ad hoc.

This document covers:

- where the skill lives in this repository
- how to point an agent runtime at it
- how to validate changes safely
- what "distribution" means today

This document does not define a marketplace or packaged publishing flow because that does not exist yet.

## Skill layout

The canonical skill files live under `skills/quantex-cli/`:

- `SKILL.md`: the main operating instructions for agents
- `agents/openai.yaml`: agent-specific metadata
- `references/`: supporting command, automation, output, and troubleshooting references
- `assets/`: icons and visual assets
- `scripts/smoke-check.sh`: lightweight validation for the Quantex command surface

When the Quantex CLI behavior changes, update the relevant canonical project-memory artifact first:

- behavior contract: `openspec/`
- durable decision: `docs/adr/`
- troubleshooting or recovery knowledge: `docs/runbooks/`

Then update the skill files so they reflect the same contract.

## Installation model

Today the Quantex skill is installed from the repository itself. There is no separate registry package, marketplace release, or standalone bundle.

Use one of these patterns:

1. Work directly from this repository when the agent runtime can read repo-local skills.
2. Copy or sync `skills/quantex-cli/` into the target skill directory if the runtime expects installed skills outside the repository.

The important requirement is that the runtime sees the whole `skills/quantex-cli/` directory, not only `SKILL.md`, because the references, metadata, assets, and smoke-check script are part of the maintained artifact.

## Validation

When maintaining the CLI surface or the skill itself, run:

```bash
skills/quantex-cli/scripts/smoke-check.sh
```

The script resolves `quantex` in this order:

1. `QUANTEX_BIN` if explicitly provided
2. `bun run src/cli.ts` from this repository when `bun` is available
3. a globally available `quantex` binary in `PATH`

Useful examples:

```bash
# Use the repo checkout with Bun
skills/quantex-cli/scripts/smoke-check.sh

# Validate against a specific built binary
QUANTEX_BIN=./dist/bin/quantex skills/quantex-cli/scripts/smoke-check.sh

# Change the smoke agent when needed
QUANTEX_SMOKE_AGENT=claude skills/quantex-cli/scripts/smoke-check.sh
```

The smoke check currently verifies:

- `capabilities --json`
- `commands --json`
- `schema --json`
- `schema inspect --json`
- `inspect <agent> --json`
- `resolve <agent> --json` when that agent is already installed

Run this after updating:

- command names or flags
- JSON envelope or schema behavior
- lifecycle command expectations in the skill
- skill references that describe structured usage

## Update flow

Use this update order:

1. Change the Quantex CLI behavior or project-memory artifact first.
2. Update `skills/quantex-cli/` so the skill matches the current contract.
3. Run `skills/quantex-cli/scripts/smoke-check.sh`.
4. If the change affects durable docs, update the linked runbook, ADR, or OpenSpec artifact in the same branch.

Treat the skill as a consumer-facing integration layer, not the source of truth for product behavior.

## Distribution today

Supported today:

- sharing the repository itself
- pinning to a repository revision or branch
- copying the repo-local skill directory into another compatible skill location

Not supported today:

- a dedicated skill package
- a public skill marketplace flow
- an automated release pipeline that publishes the skill independently from this repository

So in practice, the Quantex skill is currently distributed as part of the repository, alongside the CLI and its project-memory artifacts.

## Related files

- `skills/quantex-cli/SKILL.md`
- `skills/quantex-cli/scripts/smoke-check.sh`
- `skills/quantex-cli/references/command-recipes.md`
- `skills/quantex-cli/references/output-contracts.md`
- `docs/runbooks/quantex-troubleshooting.md`
