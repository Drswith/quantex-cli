---
name: quantex-agent-runtime
description: Use when starting or resuming any Quantex repository task; routes Superpowers-backed agent sessions through Quantex intake, OpenSpec, validation, and delivery closure.
license: MIT
---

# Quantex Agent Runtime

Use this skill at the start of every Quantex repository session, and again before final handoff.

## Runtime Stack

- Superpowers is the cross-agent workflow runtime.
- OpenSpec is the source of truth for non-trivial behavior and durable process contracts.
- GitHub Actions are the remote enforcement layer.
- Cursor Cloud Automations provide external role specialists for recurring bug finding, PR governance review, CI triage, and OpenSpec archive follow-up.
- Repository scripts are executable validation, build, release, and package checks.
- `AGENTS.md` is the thin fallback when Superpowers is unavailable.

## Session Start

1. Activate Superpowers first when the environment provides it.
2. Read `AGENTS.md` for hard mission, scope, validation, and red-line constraints.
3. Check the current branch and working tree.
4. Run `bun run openspec:list` to identify active changes.
5. Classify the user request before editing files.

## Task Start Entry

Use this canonical entry when a user starts or resumes Quantex work from a fresh agent conversation:

```text
Use quantex-agent-runtime.
Activate Superpowers first if this environment supports it.
Read AGENTS.md, skills/quantex-agent-runtime/SKILL.md, and openspec/README.md.
Check git status, the current branch, git worktree list, and bun run openspec:list.
If this will create commits or a PR, do not work on main; create or switch to a dedicated worktree branch named <agent>/<task-slug>.
Classify the request through the OpenSpec intake gate before editing files.
If OpenSpec is required, create or select the change and use openspec status/instructions to drive implementation.
Continue through validation, commit, push, PR delivery, and archive-closure reporting as far as permissions allow.
```

If the current agent has a slash command, skill command, or equivalent native entry for `quantex-agent-runtime`, use that native entry first. If it does not, paste the text entry above. The slash command is only a launcher; OpenSpec, git worktrees, branches, PRs, and archive closure remain the source of truth.

## Intake

Create or select an OpenSpec change before implementation when the work affects:

- observable CLI behavior
- stable structured output, schema, command catalog, or machine-readable contracts
- agent catalog fields, install methods, update strategies, or version probing
- configuration, state, cache, release, publishing, or upgrade behavior
- architecture boundaries
- project memory policy, durable workflow, OPSX/OpenSpec/Superpowers rules, ADR/runbook process, or GitHub collaboration flow
- product-facing documentation that changes user expectations

Small typo, formatting-only, mechanical no-behavior, and test-only cleanup may proceed without OpenSpec after stating that classification.

## OpenSpec Flow

Use repository scripts so the pinned dependency is used:

```bash
bun run openspec:list
bun run openspec:status -- --change <change-id>
bun run openspec:instructions -- <artifact> --change <change-id>
bun run openspec:validate
```

For implementation:

1. Read every context file returned by `openspec instructions apply`.
2. Complete tasks in the OpenSpec task list.
3. Mark task checkboxes only after the corresponding work is done.
4. Update specs, ADRs, runbooks, or session docs when implementation changes durable knowledge.

For an active umbrella change, a milestone merge is not archive eligibility: update genuine task progress and report merge closure, but keep the umbrella change active until its completion, promotion, spec-sync, and archive conditions are satisfied.

## Validation Routing

Always run these after modifying files:

```bash
bun run lint
bun run format:check
bun run typecheck
```

Also run:

- `bun run test` for CLI behavior, structured output, contract, integration, or executable workflow-support changes.
- `bun run openspec:validate` for OpenSpec, docs, project memory, workflow, or process changes.
- `bun run memory:check` for docs or project-memory changes.
- `bun run build`, `bun run build:bin`, and `bun run release:artifacts` for build, release, self-upgrade, or release artifact changes.

## Delivery Closure

Before creating or editing a pull request body:

1. Prepare the body as a file based on `.github/pull_request_template.md`.
2. Run `bun run pr:body:check -- --body-file <body-file> --title "<title>"`.
3. Use the validated file with `gh pr create --body-file <body-file>` or `gh pr edit --body-file <body-file>`.

Do not hand-write inline `gh pr create --body "$(cat <<EOF ...)"` payloads, and do not add a repo-local PR creation wrapper when the native `gh` command plus the validator is enough.

Before final handoff, report:

- validation state
- OpenSpec state
- git state
- commit state
- remote state
- PR state
- release state
- archive closure state

Use explicit closure labels:

- local implementation
- repository delivery
- PR delivery
- merge delivery
- OpenSpec archive closure
- release closure

## Archive Closure

Archive closure is agent-driven.

After an OpenSpec-backed implementation PR merges and the change is genuinely complete and archive-eligible:

1. Resume from a clean branch based on the protected target branch.
2. Sync accepted spec deltas into `openspec/specs/` when they are not already present.
3. Run `bun run openspec:archive-closure -- <change-id> --body-file .tmp/archive-pr-body.md`.
4. Use the generated body file when creating or editing the archive PR.
5. Run `bun run pr:body:check -- --body-file .tmp/archive-pr-body.md --title "<archive-pr-title>"` before creating or editing the archive PR.
6. Commit, push, and open the archive PR when protected branches prevent direct archive closure.

Do not rely on repository automation to create archive PRs.

If an implementation PR is only one milestone of an active umbrella change, do not start archive closure. Report that archive closure remains pending by design and resume from the protected target recorded by the active OpenSpec change.

## Script Boundary

Repository scripts are executable guardrails: validation, path classification, build metadata, package checks, release artifact generation, and release smoke verification. Prefer Superpowers runtime instructions, OpenSpec artifacts, GitHub Actions, and native CLIs for workflow actions.

Do not add project-specific workflow orchestration commands, such as `pr:create`, when a native CLI action plus a shared validator is sufficient.

## Cloud Agent Roles

Use `docs/runbooks/cloud-agent-automations.md` as the repo-native baseline when configuring or auditing external cloud-agent automations.

Current role split:

- Critical bug finder: scheduled semantic bug hunting; opens a narrow PR only for concrete high-severity bugs, otherwise reports to Slack.
- PR governance: PR-opened and PR-pushed review; comments and requests reviewers but never approves.
- CI triage: scheduled failure classification; reports root cause, evidence, owner, and minimal next step without implementing code.
- OpenSpec archive: scheduled archive-readiness follow-up; opens narrow archive PRs only after implementation merge and spec-delta readiness.

Cloud agents reduce manual repair loops by classifying and routing work earlier. They do not replace merge-gating CI, PR Governance, OpenSpec validation, release automation, local validation, or delivery closure reporting.

If a Cursor Cloud run fails because of concurrency, quota, missing Slack/GitHub connection, or provider capacity, classify it as operational capacity rather than a repository regression.

## Artifact Routing

- Behavior or durable process contract: `openspec/`.
- Long-lived decision: `docs/adr/`.
- Repeatable operation or recovery: `docs/runbooks/`.
- Session summary: `docs/sessions/`.
- Future executable work: GitHub issue.
- Never create ad hoc root-level Markdown.
