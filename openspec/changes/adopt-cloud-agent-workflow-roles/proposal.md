## Why

Quantex now uses Cursor Cloud Automations for recurring bug finding, PR governance, CI triage, and OpenSpec archive follow-up. The browser-side automation configuration is intentionally outside the repository, but the role boundaries, prompt source, escalation rules, and CI failure handling need to live in repo-native project memory so future agents do not rebuild the same single-agent, self-policing workflow.

This is a durable workflow and project-memory change. It should improve coordination without turning Quantex into a workflow orchestration platform or adding another repo-local CLI layer around native GitHub/OpenSpec actions.

## What Changes

- Document cloud-agent workflow roles as a repo-native runbook with role intent, triggers, tool expectations, model guidance, and prompt templates.
- Update the Quantex runtime skill so agents distinguish role-specific cloud automation from local implementation, CI enforcement, release automation, and OpenSpec archive closure.
- Record a project-memory contract that cloud-agent automation roles remain external scheduler configuration, while repository artifacts define their responsibilities and guardrails.
- Clarify that CI and PR Governance remain hard enforcement layers; cloud agents classify, summarize, fix, or route failures instead of replacing required checks.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: Adds a durable process contract for cloud-agent role division and prompt-source alignment.

## Impact

- Affected files: `skills/quantex-agent-runtime/SKILL.md`, `docs/github-collaboration.md`, `docs/README.md`, `docs/runbooks/cloud-agent-automations.md`, `openspec/specs/project-memory/spec.md`, and this OpenSpec change.
- Affected systems: Cursor Cloud Automation setup, coding-agent startup, PR/CI failure routing, OpenSpec archive follow-up, and workflow documentation.
- Non-goals: do not add `npm` or `bun` wrapper scripts for cloud-agent orchestration; do not weaken CI/PR Governance gates; do not move Cursor's external automation settings into versioned source; do not add product CLI behavior.
