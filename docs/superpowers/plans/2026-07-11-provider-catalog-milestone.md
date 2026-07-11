# Provider And Catalog Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` task by task, `superpowers:test-driven-development` for every behavior change, and `superpowers:verification-before-completion` before each checkpoint or delivery claim.

**Goal:** Replace duplicated provider metadata and agent-level package identity with a compile-time typed provider registry and provider-bound catalog candidates while preserving Quantex v1 CLI, state, package exports, install ordering, update strategy, and platform behavior.

**Architecture:** Add a typed provider boundary behind the existing package-manager compatibility facade. Provider capabilities come only from implemented operations; adapters return typed evidence-rich outcomes and keep their provider-specific target semantics. Normalize bundled catalog JSON around provider-bound candidates, then project it back to the maintained `AgentDefinition` surface until later lifecycle milestones consume the normalized model directly. No dynamic provider loading, command routing migration, state schema migration, or public export removal is part of this milestone.

**Tech Stack:** Bun 1.3, TypeScript 5.9, Vitest 4, Zod 4, OpenSpec 1.3.

## Scope and completion boundary

This plan implements OpenSpec tasks `4.1` through `4.14` in recoverable checkpoints:

- typed first-party provider contracts, registry, outcomes, verification evidence, and derived capabilities;
- a reusable provider conformance suite;
- typed adapters for npm, Bun, Homebrew, winget, Cargo, Deno, pip, uv, and mise;
- explicit script and standalone-binary candidate effects;
- provider-bound catalog candidates and declarative probes for every bundled agent;
- generated catalog validation/support data from the normalized model.

It does not complete task `2.4` unless every existing command/provider execution path stops using boolean outcomes. It does not migrate lifecycle observation, command handlers, state receipts, or public compatibility projections, so tasks from phases 5 and later remain unchecked.

## Global constraints

- Do not read, copy, cherry-pick, or depend on the ignored refactor PR/worktree or Codex session `019f44f7-735b-79b3-83a1-1fd4d4da5334`.
- Preserve current accepted CLI calls, human/JSON/NDJSON output, exit mapping, agent names, aliases, executable names, platform coverage, install-method ordering, package targets, update strategies, and legacy state readability.
- The normalized catalog is source of truth; the maintained `AgentDefinition` shape is a compatibility projection, not a second hand-maintained identity map.
- Provider capabilities are derived from operation presence. Do not add another capability table or hard-coded provider bucket list.
- Every behavior change starts with a focused failing test and ends with focused tests plus lint, format check, and typecheck.
- Mark an OpenSpec checkbox only after its literal provider group or generated output is completely migrated and verified.
- Each task writes `.superpowers/sdd/task-N-report.md`, updates `.superpowers/sdd/progress.md`, and creates a local checkpoint commit before starting the next task.
- Preserve checkpoint history on a local task-history branch. Before delivery, normalize the milestone to one reviewable commit and keep only durable implementation/plan artifacts in the PR.
- Pull-request merge strategy is rebase first and squash only when rebase is unavailable; do not select merge-commit delivery automatically.

## Recovery protocol

1. Read `.superpowers/sdd/progress.md` and the current task brief before doing work.
2. Verify `git status`, `HEAD`, and the last recorded validation command.
3. Resume only the first task whose state is not `complete`; never rerun completed mechanical catalog groups without evidence of drift.
4. Keep remote operations outside implementation checkpoints. A network failure cannot invalidate a local task commit.
5. Retry short GitHub operations independently; never use a long watch as the only source of state.

---

## Task 1: Define typed provider contracts and compile-time registry

**Files:**

- Create: `src/providers/types.ts`
- Create: `src/providers/registry.ts`
- Create: `src/providers/index.ts`
- Create: `test/providers/registry.test.ts`
- Modify later in this task only if needed: `src/package-manager/installers.ts`

Write failing tests for unique stable provider IDs, immutable lookup/list results, capabilities derived from optional operations, typed availability/observation/mutation/verification outcomes, and absence of dynamic registration. Define target, operation-context, observation, verification-evidence, failure, and outcome types without importing CLI presenters or Commander. Establish the first-party registry without routing existing commands through it yet. Mark `4.1` only when the registry exposes all required operation categories with typed results.

Checkpoint: `feat(providers): add typed provider registry`

## Task 2: Add the reusable provider conformance harness

**Files:**

- Create: `test/providers/conformance.ts`
- Create: `test/providers/conformance.test.ts`
- Modify: `test/providers/registry.test.ts`

Build one reusable suite that proves unsupported operations remain absent/typed, failures preserve safe command and exit evidence, already-aborted signals yield cancellation, timeout is distinct from failure, observations distinguish present/absent/indeterminate, and successful mutations provide verification evidence. Run it first against deterministic fixture adapters; later tasks register every real adapter with the same suite. Do not mark `4.2` until all real adapters pass.

Checkpoint: `test(providers): add adapter conformance suite`

## Task 3: Migrate npm and Bun adapters

**Files:**

- Create: `src/providers/adapters/npm.ts`
- Create: `src/providers/adapters/bun.ts`
- Create/modify: `test/providers/npm.test.ts`, `test/providers/bun.test.ts`
- Modify: `src/providers/registry.ts`
- Modify: `src/package-manager/installers.ts`

Wrap or move npm/Bun operations behind typed adapters, preserving `latest-major` versus `respect-semver`, registry normalization, Bun trust/rollback behavior, presence parsing, installed-version probing, and batch update semantics. Keep the legacy installer facade as a thin boolean compatibility projection. Mark `4.3` when focused legacy and conformance tests pass.

Checkpoint: `refactor(providers): migrate npm and bun adapters`

## Task 4: Migrate Homebrew and winget adapters

Preserve formula/cask target kinds, exact winget package IDs, command arguments, batch ordering, and unsupported version-discovery semantics. Run the conformance suite plus existing package-manager tests. Mark `4.4` only after both adapters are registered.

Checkpoint: `refactor(providers): migrate brew and winget adapters`

## Task 5: Migrate Cargo and Deno adapters

Preserve Cargo install arguments and force-update behavior; preserve Deno package arguments, executable-name-based uninstall, and batch binary metadata. Run conformance plus existing Cargo/Deno tests. Mark `4.5` only after both adapters are registered.

Checkpoint: `refactor(providers): migrate cargo and deno adapters`

## Task 6: Migrate pip, uv, and mise adapters

Preserve pip command discovery, uv tool arguments/presence/version behavior, mise plugin identity/presence/version parsing, and provider-specific batch behavior. Run conformance and existing tests. Mark `4.6` only after all three adapters are registered.

Checkpoint: `refactor(providers): migrate python and mise adapters`

## Task 7: Derive capabilities and update grouping from the registry

**Files:**

- Modify: `src/package-manager/capabilities.ts`
- Modify: `src/package-manager/index.ts`
- Modify: `src/commands/update.ts`
- Modify: related focused tests

Represent script and standalone binary effects explicitly without dynamic loading. Replace `INSTALLER_CAPABILITIES`, managed-type classification duplication, and hard-coded update-provider enumeration with registry-derived operations/order. Keep compatibility helper return shapes and update ordering stable. Mark `4.7`, `4.8`, and finally `4.2` only when every registered provider passes conformance.

Checkpoint: `refactor(providers): derive lifecycle capabilities`

## Task 8: Introduce normalized provider-bound catalog candidates

**Files:**

- Modify: `src/agents/types.ts`
- Modify: `src/agents/schema.ts`
- Modify: `src/agents/catalog.ts`
- Modify: `test/agents.test.ts`
- Regenerate: `src/agents/catalog.schema.json`

Start with failing schema/projection tests. Define one candidate record containing provider/kind, provider-specific target identity, supported platforms, priority/order, executable override, operation arguments, and declarative probe definitions. Remove package identity from raw agent-level `packages`; generate any maintained legacy `packages`/`platforms` fields from candidates in the compatibility projection. Mark `4.9` only after duplicate/missing identity and undeclared probe cases fail validation.

Checkpoint: `refactor(catalog): bind provider identity to candidates`

## Task 9: Migrate managed catalog entries in bounded groups

Migrate and validate catalog JSON in four separate internal checkpoints, preserving exact agent/platform/order snapshots:

1. npm, Bun, and mise (`4.10`);
2. Cargo, Deno, pip, and uv (`4.11`);
3. Homebrew and winget (`4.12`);
4. script and standalone binary (`4.13`).

After each group, regenerate manifests/schema, run the catalog snapshot/invariant tests, write a report, and commit before touching the next group.

Checkpoint series: `refactor(catalog): migrate <group> candidates`

## Task 10: Generate catalog support data and documentation inputs

**Files:**

- Modify: `scripts/write-agent-catalog-manifest.ts`
- Modify/create focused generator tests and generated support artifact(s)
- Modify durable catalog documentation only if generated by the chosen source-of-truth path

Generate provider/platform/probe support data from the normalized parsed model rather than scanning independent fields. Add deterministic stale-output validation. Mark `4.14` only when generation and checked-in outputs are reproducible.

Checkpoint: `docs(catalog): generate provider support matrix`

## Task 11: Milestone compatibility and delivery closure

Run focused suites after each task, then run:

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run agent-catalog:generate
git diff --exit-code
bun run openspec:validate
bun run memory:check
bun run build
```

Update only genuinely satisfied OpenSpec tasks. Request independent spec and code-quality reviews, fix findings with focused regression tests, preserve the task-history branch, normalize to one conventional commit, validate the PR body, push, and create a PR targeting `codex/redesign-lifecycle-integration`. Use rebase merge when allowed, otherwise squash. Confirm integration push does not trigger Release.
