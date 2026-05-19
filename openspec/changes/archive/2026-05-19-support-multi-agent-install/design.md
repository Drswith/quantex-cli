## Context

Quantex already supports batch lifecycle behavior where the product meaning is clear, such as `update --all`, but the install surface is still modeled as a single-agent command. The current install implementation also carries single-target human output, single-target structured data, and no per-agent progress stream for multi-target requests.

## Goals / Non-Goals

**Goals:**

- Support `quantex install <agent> [more-agents...]` and `qtx i <agent> [more-agents...]`.
- Preserve the existing single-agent result shape and human behavior when exactly one agent is requested.
- Execute explicit multi-agent installs sequentially under the existing lifecycle lock model.
- Return and render per-agent outcomes clearly for human, JSON, and NDJSON output modes.

**Non-Goals:**

- Add `install --all`.
- Add parallel installation or lock partitioning.
- Generalize Quantex into a workflow or stdin-driven batch execution surface.
- Change `ensure`, `uninstall`, or unrelated lifecycle commands in the same change.

## Decisions

- Treat multi-agent install as an explicit batch mode triggered only when the user passes more than one target.
  - Alternative considered: always normalize install output to a batch shape, even for one target. Rejected because it would unnecessarily break existing single-agent structured consumers.
- Run each requested install sequentially by reusing the current single-agent install flow.
  - Alternative considered: parallelize installs. Rejected because the existing `agent lifecycle` lock already serializes lifecycle mutations and the product does not need orchestration semantics here.
- Continue after individual failures and return a batch-level error when any requested agent fails.
  - Alternative considered: fail fast on the first error. Rejected because users asking for multiple explicit installs expect as much progress as possible in one invocation.
- Emit per-agent NDJSON progress events and a human summary only for batch mode.
  - Alternative considered: keep NDJSON silent until the final result. Rejected because batch installs benefit from the same streamability that `update --all` already exposes.

## Risks / Trade-offs

- Multi-agent JSON output becomes mode-dependent on the number of requested targets -> Mitigation: keep single-target compatibility and document batch-only fields through the schema/catalog updates.
- Reusing single-agent logic in a batch loop can duplicate warnings and event semantics -> Mitigation: factor the install command into a reusable per-agent execution path and let the batch wrapper control aggregation and progress emission.
- Users may expect `install --all` after this change -> Mitigation: keep the proposal, README, and spec text explicit that only multiple named targets are supported.
