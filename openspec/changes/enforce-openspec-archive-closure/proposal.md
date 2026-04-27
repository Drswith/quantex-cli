## Why

Quantex currently relies too much on the implementer remembering to archive a completed OpenSpec change after the implementation PR merges. That makes it too easy to stop at "merged and released" while leaving project memory in a half-closed state.

## What Changes

- Define that an OpenSpec-backed change is not fully closed until its spec delta is synced and the change is archived.
- Add repository automation that detects completed active changes on protected branches, archives them, and opens a follow-up PR automatically.
- Document the new "implemented vs archived" distinction in the collaboration and agent workflow docs.
- Clean up the already-merged `add-kilo-code-cli-support` change by archiving it as part of this fix.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: Require completed OpenSpec changes to be archived after merge so active change folders do not remain as stale project-memory debt.

## Impact

- Affected files: `openspec/specs/project-memory/spec.md`, `openspec/README.md`, `docs/github-collaboration.md`, `AGENTS.md`, and new automation under `.github/workflows/` plus supporting scripts.
- No Quantex product CLI behavior, package artifact, or release contract changes.
