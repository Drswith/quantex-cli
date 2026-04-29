## Why

Quantex has accumulated strong repo-native memory, OpenSpec contracts, generated OPSX skills, agent-specific command wrappers, and workflow automation, but a fresh session in a different agent can still miss the intended intake, validation, and closure rhythm. The repository is paying the cost of duplicating workflow instructions across many agent directories without getting a reliable cross-agent session runtime.

This is a durable workflow and project-memory architecture change. Superpowers should become the cross-agent execution runtime for session startup, intake, planning, implementation, review, and delivery closure, while OpenSpec remains the source of truth for behavior and process contracts.

## What Changes

- Establish Superpowers as the preferred cross-agent workflow runtime for Quantex sessions.
- Add a central Quantex agent runtime skill that wraps Superpowers with Quantex-specific OpenSpec, validation, artifact-routing, and delivery-closure rules.
- Replace generated per-agent OPSX skill/command copies with thin bootstrap pointers to the central runtime.
- Keep product build, package, release artifact, and required CI validation scripts in the repository.
- Remove the OpenSpec archive bot workflow and its helper script; archive closure becomes an explicit Superpowers/agent-driven delivery step after implementation merge.
- Update project-memory and collaboration documentation so future agents treat Superpowers as the runtime, OpenSpec as the contract, and GitHub Actions as enforcement rather than lifecycle orchestration.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: Replaces generated OPSX-per-agent workflow distribution with a Superpowers-backed Quantex agent runtime and changes archive closure ownership from repository automation to agent-driven closure.

## Impact

- Affected files: `AGENTS.md`, `openspec/README.md`, `openspec/specs/project-memory/spec.md`, `docs/github-collaboration.md`, `docs/README.md`, agent-specific workflow directories, `.github/workflows/openspec-archive.yml`, `scripts/archive-completed-openspec-changes.ts`, and new central runtime skill documentation.
- Affected systems: agent session startup, non-trivial change intake, delivery closure, OpenSpec archive closure, and generated OPSX integration maintenance.
- Non-goal: do not move product build/release artifact scripts or GitHub required checks into Superpowers.
