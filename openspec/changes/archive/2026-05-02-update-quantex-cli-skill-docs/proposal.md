## Why

The repo-provided skill documentation has drifted from the current CLI surface and from the intended audience split between user-facing Quantex operation and contributor-facing repository workflow. Updating it now prevents external agents from relying on stale supported-agent lists or installing the development runtime as part of the normal user path.

## What Changes

- Refresh `skills/quantex-cli` references so they match the current supported-agent catalog and troubleshooting guidance.
- Clarify that `skills/quantex-cli` is the user/agent-facing skill for operating Quantex.
- Clarify that `skills/quantex-agent-runtime` is contributor-facing repository workflow runtime, not a general user-facing skill.
- Keep the change documentation-only; no CLI behavior, schema, package distribution, or runtime behavior changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `product-readme`: clarify the user-facing skill path versus contributor runtime guidance.
- `project-memory`: clarify that the central Quantex runtime skill is a repository development workflow artifact, not the public Quantex operation skill.

## Impact

- Affected docs: `docs/skill-installation-and-distribution.md`, `README.md`, and `README.zh-CN.md` if needed.
- Affected skill files: `skills/quantex-cli/references/*.md`.
- No changes to `src/`, CLI output contracts, command schemas, install behavior, or package artifacts.
