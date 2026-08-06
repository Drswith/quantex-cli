## Why

The latest `main` source is v1.8.8 and has retired the beta release branch and npm dist-tag while tightening uninstall reconciliation. Several current README, runtime, runbook, and OpenSpec passages still describe beta as a maintained release path or do not explain why a residual `PATH` copy can remain after a managed uninstall, so users and agents can follow outdated guidance.

## What Changes

- Align current release, CI, project-memory, runtime, and worktree documentation with `main` as the only maintained release line.
- Keep the CLI's existing `--channel beta` self-upgrade selector documented as a compatibility/explicit-preview selector, without presenting it as a repository release channel.
- Add English and Simplified Chinese README guidance explaining that uninstall removes Quantex-tracked managed installs and does not remove separately owned `PATH` copies.
- Add troubleshooting guidance for the `conflicting-source` uninstall result caused by a residual `PATH` executable after conclusive managed-package removal.
- Correct the current release spec and audit session's retired npm `beta` dist-tag status; preserve historical ADR wording as historical record.
- Update stale `beta` branch references in current CI, runtime, project-memory, release, and worktree guidance.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `product-readme`: document the retired release channel distinction and managed-uninstall ownership boundary.
- `release-workflow`: align the current protected-branch contract with the retired beta branch and dist-tag state.
- `code-quality-tooling`: scope current CI gate requirements to the only maintained release branch, `main`.
- `project-memory`: keep archive-closure guidance aligned with the current protected-branch model.

## Impact

This is a documentation and contract-alignment change across README files, current runbooks, the central contributor runtime, current OpenSpec specifications, and one stale release-contract comment. It does not change CLI behavior, public APIs, dependencies, release automation, or uninstall implementation; it makes the already-shipped behavior and current release state explicit.

Intake classification: OpenSpec required because the work changes product-facing documentation and durable release/project-memory contracts.
