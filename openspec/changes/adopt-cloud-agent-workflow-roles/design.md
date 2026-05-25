# Design

## Context

The repository already has strong executable guardrails:

- GitHub Actions runs CI, PR Governance, release verification, release automation, and sandbox validation.
- Repository scripts implement narrow deterministic validators and artifact checks.
- OpenSpec owns non-trivial behavior and durable workflow contracts.
- The Quantex runtime skill tells a coding agent how to start, validate, deliver, and close work.

The new automation layer is different: Cursor Cloud Automations are external always-on agents with schedules or event triggers and role-specific prompts. Their configuration cannot be fully stored in the repository, but the responsibilities they are expected to follow should be reviewable and durable.

## Goals / Non-Goals

**Goals:**

- Define the four current cloud-agent roles: critical bug finder, PR governance reviewer, CI triage reporter, and OpenSpec archive follow-up.
- Keep role prompts in a repo runbook so browser-side automation settings can be audited against versioned text.
- Make the runtime skill route agents to the cloud-agent runbook when they are checking or updating automation behavior.
- Reduce avoidable red-CI repair loops by making CI triage a separate classification task before implementation changes.
- Preserve CI and PR Governance as hard gates.

**Non-Goals:**

- Do not implement a multi-agent scheduler in Quantex.
- Do not add repo-local `automation:*`, `pr:create`, or release orchestration scripts.
- Do not remove required checks or lower validation standards.
- Do not make external Cursor automation configuration the source of truth.

## Decisions

### Decision: keep cloud-agent configuration external but role contracts in the repo

Cursor owns the actual automation triggers, schedules, model choice, and connected tools. The repository owns the role descriptions and prompt templates that should be copied into those automations.

Why this split:

- Cursor automation state changes through the Cursor UI/API, not through this repository.
- Versioned prompt templates give reviewers a concrete baseline for drift checks.
- The repo can evolve role responsibilities through OpenSpec when the durable workflow changes.

### Decision: treat cloud agents as role specialists, not a workflow engine

Each automation should have a narrow responsibility and a clear output path:

- bug finder: open a narrow PR only for concrete high-severity bugs; otherwise send a short Slack summary
- PR governance: comment on PRs and request reviewers, but never approve
- CI triage: classify failures and report owner/next step, but not implement
- OpenSpec archive: open archive PRs only after implementation merge and spec-delta readiness

This preserves Quantex's non-goal of avoiding workflow orchestration inside the product repo.

### Decision: CI remains the hard enforcement layer

Cloud agents may reduce repair loops by detecting the likely failure class earlier, but they must not replace merge-gating CI, PR Governance, OpenSpec validation, or local preflight requirements.

Why:

- CI is deterministic and auditable.
- Cloud agents can be quota-limited, unavailable, or mistaken.
- The safest split is "agent classifies and proposes; CI enforces."

### Decision: model choice follows task judgment requirements

Use a stronger model for semantic review tasks that require source reasoning, policy interpretation, or high-confidence PR decisions. Use a general model for mechanical reporting tasks that read current state and produce a bounded summary.

The runbook records current recommendations without making model names part of a product contract.

## Risks / Trade-offs

- [Prompt drift between Cursor UI and repo runbook] -> Keep the runbook as the review baseline and ask PR Governance/maintainers to compare changes against it when automation behavior is adjusted.
- [Cloud quota failures make automation appear broken] -> CI triage prompt must classify Cursor Cloud quota/concurrency as operational capacity, not a repository regression.
- [Specialized agents overlap and produce noise] -> Each role has explicit non-goals and output constraints.
- [More docs without enforcement] -> Existing CI/OpenSpec/memory checks validate the repo artifacts; external automation still needs manual UI verification when changed.
