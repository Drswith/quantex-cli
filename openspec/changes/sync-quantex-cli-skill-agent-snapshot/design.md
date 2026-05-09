## Context

`skills/quantex-cli` is the public agent-facing operation skill. It intentionally mirrors stable user-facing Quantex guidance, while the running CLI remains the source of truth for exact support.

The implemented catalog and README already include `deepseek` and `jcode`. Only the skill command recipe snapshot lagged behind.

## Decision

Keep this as a documentation synchronization change. Do not alter CLI behavior, catalog metadata, command schemas, or runtime workflow.

The skill should continue to say that `quantex capabilities --json` and `quantex commands --json` are authoritative for live environments.

## Validation

- Run the skill smoke check to verify discovery commands and structured envelopes.
- Run the standard documentation-change validation set from the repository gate.
