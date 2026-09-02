# Design: stop-advisory-ci-schedules

## Context

`sandbox-tests.yml` currently fires on Tuesday cron plus manual dispatch. `agent-canary.yml` fires on Saturday cron, relevant pull requests, and manual dispatch. Both workflows are advisory; only PR canaries and merge-gating CI matter for delivery.

OpenSpec currently requires standing schedules for both advisory workflows, and `test/workflow-classification.test.ts` asserts the `schedule:` blocks exist.

## Goals / Non-Goals

**Goals:**

- Stop automatic cron for both advisory workflows.
- Keep `workflow_dispatch` so maintainers can still run full coverage on demand.
- Keep Agent Canaries `pull_request` quick matrix unchanged.
- Align comments, runbook/README sentences, OpenSpec deltas, and contract tests with the new triggers.

**Non-Goals:**

- Changing Windows merge gates, governance, release-please, Core publishing, OpenSpec/memory CI gates, catalog/agents, or product features.
- Disabling PR canaries.
- Refactoring dead `github.event_name == 'schedule'` expression branches beyond what is required for correctness (leaving them is harmless once schedule is gone).
- Broader delivery-simplification steps beyond this schedule removal.

## Decisions

1. **Delete the `schedule` keys only.** Hypothesis confirmed as the minimal trigger change; `workflow_dispatch` (and canary `pull_request`) stay as declared today.
2. **Update OpenSpec deltas for both capabilities.** Specs currently require standing schedules; changing triggers without deltas would leave a false contract.
3. **Touch only sentences that claim automatic schedule.** Do not rewrite isolation/canary runbooks beyond those matching claims (plus the README sentences that mirror them).
4. **Leave canary scope expression intact.** `QTX_CANARY_SCOPE` still resolves `full` from `workflow_dispatch` inputs and `quick` from pull requests; the unreachable `schedule` branch is harmless.

## Risks / Trade-offs

- [Risk] Full sandbox or full canary coverage stops running unless someone dispatches it → Mitigation: keep `workflow_dispatch`; document that manual dispatch still provides coverage.
- [Risk] Docs/tests/specs drift from workflows → Mitigation: update the asserted trigger contracts and matching sentences in the same change.
