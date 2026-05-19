## ADDED Requirements

### Requirement: Explicit multi-agent install MUST execute sequentially and report per-agent outcomes

The install lifecycle surface SHALL accept multiple explicit agent targets in one command without changing Quantex into a general batch orchestration platform.

#### Scenario: Installing multiple explicit agents

- GIVEN the user runs `quantex install agent-a agent-b`
- WHEN Quantex executes the request
- THEN it processes the requested agents sequentially
- AND it reports an individually understandable outcome for each requested agent
- AND the command ends with a concise batch summary in human output

#### Scenario: Preserving single-agent install behavior

- GIVEN the user runs `quantex install <agent>` with exactly one target
- WHEN Quantex returns the result
- THEN the command preserves the existing single-agent install semantics
- AND it does not force single-agent callers onto a batch-only result shape

#### Scenario: Continuing after a batch item fails

- GIVEN the user runs `quantex install agent-a agent-b agent-c`
- AND one requested agent cannot be installed or resolved
- WHEN Quantex completes the batch
- THEN it still attempts the remaining requested agents
- AND the final command result indicates that the batch had one or more failures
- AND the per-agent results identify which targets succeeded, failed, or were already installed
