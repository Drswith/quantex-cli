# Proposal: stop-advisory-ci-schedules

## Why

Standing cron schedules for advisory `Sandbox Tests` (Tuesday) and `Agent Canaries` (Saturday) create recurring CI noise without acting as merge gates. Delivery simplification step 1 removes those automatic schedules while preserving manual dispatch and existing PR canaries.

## What Changes

- Remove the `schedule` trigger from `.github/workflows/sandbox-tests.yml`; keep `workflow_dispatch` only.
- Remove the Saturday `schedule` trigger from `.github/workflows/agent-canary.yml`; keep `pull_request` and `workflow_dispatch` unchanged.
- Update workflow header comments and matching runbook/README sentences so they no longer claim a standing schedule.
- Update contract tests that currently assert those schedule blocks exist.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-quality-tooling`: Modal-backed sandbox workflow coverage becomes manual-dispatch-only (no standing schedule).
- `agent-canary-validation`: Full-scope canary coverage becomes manual-dispatch-only; PR quick canaries remain.

## Impact

- `.github/workflows/sandbox-tests.yml`, `.github/workflows/agent-canary.yml`
- `docs/runbooks/modal-sandbox-testing.md`, `README.md`, `README.zh-CN.md`
- `test/workflow-classification.test.ts`
- `openspec/specs/{code-quality-tooling,agent-canary-validation}/spec.md` (via this change's deltas)

No CLI behavior, catalog, release, governance, or merge-gate changes. PR canaries stay enabled.

## Intake classification

Durable GitHub Actions workflow-trigger and advisory CI process contract change; OpenSpec required.
