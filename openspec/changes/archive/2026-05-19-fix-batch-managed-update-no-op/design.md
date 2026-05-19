## Context

Grouped managed updates can reach `updateAgentsByType` with a list of package specs that becomes empty after invalid or blank package names are filtered. Some installer helpers treat empty package lists as successful no-ops, which can incorrectly mark agents as updated.

## Decision

Fail closed at the shared package-manager boundary when no usable package names remain:

- return `false` instead of invoking installer-specific update helpers with empty work
- preserve the higher-level fallback path so individual agent outcomes can still be reported accurately
- cover the boundary with package-manager tests

## Risk

The behavior intentionally converts a previous vacuous success into a failure path. That is the correct tradeoff because reporting no installer work as an update is less accurate than falling back to per-agent handling.
