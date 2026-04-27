## Why

Recent agent work followed the intake gate and completed implementation tasks, but still stopped early at several different meanings of “done” until prompted again. The workflow needs an explicit delivery closure gate so agents know what must be checked before saying a task is complete.

Work-intake classification: this is a durable-process change, so OpenSpec is required before implementation.

## What Changes

- Define a delivery closure gate for agent-executed work.
- Distinguish implementation completion, repository delivery, PR delivery, merge completion, and OpenSpec archive closure.
- Require agents to run final closure checks before final answers, including OpenSpec status, validation, git status, commit/push/PR state, and archive expectations.
- Document how protected branches affect closure: an OpenSpec-backed implementation PR can be delivered before archive closure, but the final answer must state that archive closure is pending or delegated to automation.
- Update agent-facing and GitHub collaboration guidance so future agents do not stop at “tests passed” when commit, PR, or archive status remains open.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: Adds the delivery closure gate and final-answer closure checks for OpenSpec-backed work.

## Impact

- Affected files: `AGENTS.md`, `openspec/README.md`, `openspec/config.yaml`, `.github/pull_request_template.md`, `.github/workflows/pr-governance.yml`, `.github/workflows/openspec-archive.yml`, `docs/github-collaboration.md`, and the OpenSpec change/spec artifacts.
- No runtime CLI behavior, package output, dependency, or release automation changes.
