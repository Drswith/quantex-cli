# OpenSpec

This repository uses OpenSpec for behavior contracts and non-trivial change planning. Agent session behavior is routed through Superpowers and the central Quantex runtime skill.

## Structure

| Path | Purpose |
|---|---|
| `openspec/specs/` | Current source-of-truth behavior specifications |
| `openspec/config.yaml` | Project context and artifact rules injected into OpenSpec instructions |
| `openspec/changes/` | Proposed non-trivial changes before they are fully merged |
| `openspec/changes/archive/` | Completed changes that have already been merged into current specs |

## Working rule

- before implementation or file edits, classify the work through the intake gate
- activate Superpowers first when it is available
- use `skills/quantex-agent-runtime/SKILL.md` for Quantex-specific session startup, intake, validation, and closure rules
- use Superpowers brainstorming or equivalent for open-ended investigation
- use `openspec new change <name>` for non-trivial behavior or durable-process changes
- use `openspec status --change <name> --json` to inspect which artifacts are ready or missing
- use `openspec instructions <artifact> --change <name> --json` when an agent needs artifact-specific guidance
- use OpenSpec instructions plus the Quantex runtime skill to implement tasks while updating artifacts as learning happens
- after implementation, apply the delivery closure gate before reporting the work as complete
- after the implementation PR lands, the change is still only "implemented"
- treat the change as fully "done" only after specs are synced and `openspec archive <name> --yes` has moved it into `openspec/changes/archive/`
- protected branches close that final gap through an explicit agent-driven archive follow-up, not repository bot automation

Prefer Superpowers for agent behavior and the official OpenSpec CLI for OpenSpec state transitions. This repository should store OpenSpec artifacts, not grow custom project-management commands unless they directly serve Quantex users.

## Intake gate

Implementation requests must be classified before editing files. Execution-oriented intent, continuation intent, or closure intent is not permission to skip OpenSpec.

Create or select an OpenSpec change first when the work affects:

- observable CLI behavior
- stable structured output, schema, command catalog, or machine-readable contract
- agent catalog fields, install/update metadata, version probes, or execution semantics
- configuration, state, cache, release, publishing, or upgrade behavior
- architecture boundaries or durable workflow rules
- product-facing documentation that changes user expectations

OpenSpec is optional only for typo fixes, formatting-only edits, small wording cleanup with no product/process meaning change, mechanical no-behavior maintenance, or test-only cleanup that does not redefine expected behavior. If an agent skips OpenSpec, it should briefly state that classification before proceeding.

## Delivery closure gate

OpenSpec-backed work has multiple closure states:

- implementation complete: tasks are done and validation passes locally
- PR delivered: changes are committed, pushed, and linked from a PR
- merge complete: the implementation PR has landed on the protected branch
- archive closed: accepted spec deltas have been synced and the OpenSpec change has moved to `openspec/changes/archive/`
- release closed: release automation has completed when the change is release-worthy

Agents should not report “complete” without stating which closure state was reached. For protected branches, it is valid for an implementation PR to be delivered while archive closure remains pending; in that case the final answer must explicitly say that a Superpowers/Quantex-runtime archive follow-up owns the remaining closure.

The CLI is pinned as a project dev dependency. Use the repo scripts instead of relying on a global install:

```bash
bun run openspec:list
bun run openspec:status -- --change <change-name>
bun run openspec:show -- <change-or-spec-name>
bun run openspec:instructions -- proposal --change <change-name>
bun run openspec:validate
bun run openspec:new -- <change-name>
bun run openspec:archive -- <change-name>
```

The repository no longer maintains full generated OPSX workflow copies for every supported agent. Keep agent-specific files as thin bootstraps that activate Superpowers and route to `skills/quantex-agent-runtime/SKILL.md`; put durable project-specific context in OpenSpec, `openspec/config.yaml`, and canonical docs.

Current runtime profile:

- Superpowers supplies the agent workflow discipline
- OpenSpec supplies the change contract and state commands
- Quantex runtime skill supplies project-specific intake, validation, artifact routing, and closure rules

Do not reintroduce full per-agent OPSX command bodies without a new OpenSpec change.

Archive timing:

- do not archive an active change before its implementation PR has merged
- sync any accepted spec delta into `openspec/specs/` before archiving
- run `bun run openspec:validate` before and after archive operations
- on `main` and `beta`, an agent should open an archive follow-up PR for completed active changes so merge/release success does not leave project memory half-closed

Small fixes that do not alter behavior contracts can still go directly through GitHub Issue/PR review without an OpenSpec change.
