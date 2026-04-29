## Why

Users and maintainers need a single support-matrix view that distinguishes Quantex's canonical agent slug from the upstream CLI command name. Without an explicit rule, entries such as Cursor (`cursor` vs `agent`) require repeated manual interpretation and make catalog reviews drift-prone.

## What Changes

- Define support-matrix field rules for product name, canonical slug, binary command, aliases, and support status.
- Document the default naming rule: prefer the upstream CLI command as the canonical slug when it is stable and product-specific.
- Document the exception rule: keep a branded canonical slug when the executable name is too generic or ambiguous, and record the executable separately as the binary command.
- Add a repository docs page for the agent support matrix so supported, in-progress, candidate, and excluded tools can be reviewed without changing runtime code.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: clarify canonical slug versus binary command semantics and define the support-matrix documentation fields used to review catalog entries

## Impact

- `openspec/specs/agent-catalog/spec.md`
- `docs/agent-support-matrix.md`
- `docs/README.md`
