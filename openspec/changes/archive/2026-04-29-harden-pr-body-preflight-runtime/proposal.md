## Why

PR body governance now catches malformed pull request descriptions in CI, but agents can still create a PR with an invalid hand-written body and only discover the problem after PR Governance turns red. The fix should left-shift the existing validator into the agent delivery flow without adding another repo-local workflow CLI or wrapping native `gh` behavior.

This is a durable workflow and project-memory change because it changes how supported agent sessions deliver PRs.

## What Changes

- Require agents to prepare PR bodies as files based on `.github/pull_request_template.md` before creating or editing pull requests.
- Require agents to run the existing local `bun run pr:body:check` command before `gh pr create` or `gh pr edit` when a PR body is provided.
- Clarify that Quantex keeps repository scripts as validators, classifiers, build helpers, and release artifact checks, not as general workflow orchestration commands.
- Explicitly discourage adding repo-local wrappers such as `pr:create` when a native tool plus a shared validator is sufficient.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: defines the Superpowers-backed delivery runtime boundary between agent instructions, native tools, and repo-local validation scripts.
- `release-governance`: requires PR body governance to be run before PR creation or PR body edits, not only inside GitHub Actions.

## Impact

- Affected artifacts: `AGENTS.md`, `skills/quantex-agent-runtime/SKILL.md`, `openspec/specs/project-memory/spec.md`, and `openspec/specs/release-governance/spec.md`.
- Affected systems: agent PR delivery closure, PR Governance preflight, and repository script boundary.
- Non-goal: do not introduce a `pr:create`, `workflow:*`, or similar repo-local command that wraps GitHub pull request creation.
