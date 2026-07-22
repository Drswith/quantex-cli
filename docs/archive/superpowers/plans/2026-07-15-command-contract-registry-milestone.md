# Command Contract Registry Milestone

Base: `origin/codex/redesign-lifecycle-integration@504d069f7058a47bc01136a88d02e45a680405a4`

Branch: `codex/redesign-command-contract-registry`

OpenSpec change: `redesign-lifecycle-engine`

## Goal

Complete OpenSpec tasks 3.1–3.7 by making one compile-time command contract registry authoritative for the stable CLI surface. Commander registration, global options, command discovery, schema discovery, shortcut normalization, handlers, effects, and presentation selection must be derived from or validated against that registry while preserving every accepted v1 invocation and structured shape.

## Boundaries

- Preserve all stable command names, aliases, arguments, option spellings/defaults, passthrough behavior, exit codes, JSON/NDJSON v1 envelopes, human behavior, and package/root exports.
- Keep command handlers lazily imported so startup and self-version behavior do not regress.
- Do not remove the package-manager compatibility facade, legacy state projection, root exports, package/binary aliases, or command-specific lifecycle implementations in this milestone.
- Do not mark OpenSpec 2.4 or Phase 10 tasks complete. Typed boolean-boundary removal is verified only when default mutation routes no longer depend on it.
- Do not add workflow orchestration, dynamic command loading, or a plugin command API.
- The registry may reference compatibility presenters and handler factories, but domain/application modules must not import Commander or v1 output shapes.

## Delivery model

1. Commit each reviewed task as a recovery checkpoint.
2. Preserve the final granular head at `refs/quantex/recovery/redesign-command-contract-registry-granular`.
3. Rebase on the latest integration before delivery.
4. Normalize the milestone to one review commit only immediately before the PR.
5. Validate the PR body, open a ready PR to `codex/redesign-lifecycle-integration`, wait for required checks and independent review, then merge with rebase preference and verify integration tree equality.
6. Never enable auto-merge and never include integration in a release trigger.

## Task 1: Lock the complete registry contract

Files expected:

- Modify: `src/command-contract/registry.ts`
- Modify: `src/command-contract/index.ts`
- Modify: `test/command-contract/registry.test.ts`

Add typed argument and option definitions, target resolution, effect declarations, handler resolution, schema references, and presenter identity for every stable command. Add validation for duplicate arguments/options, unresolved handlers/presenters, incompatible option definitions, missing schema references, and declared-effect mismatches. Keep handler imports lazy and make invalid registry states fail deterministically in tests.

Checkpoint evidence:

- focused registry tests pass;
- lint, format check, and typecheck pass;
- OpenSpec remains 53/74 until the remote milestone evidence is complete.

## Task 2: Generate Commander registration and global options

Files expected:

- Add: `src/command-contract/commander.ts`
- Modify: `src/cli.ts`
- Add/modify: `test/cli-registration.test.ts`

Build the Commander program from the registry, including aliases, arguments, options, passthrough exceptions, action adapters, and global option hooks. Preserve lazy command imports, idempotency policy factories, update invocation disposal, exec passthrough extraction, exit mapping, and current parse error behavior.

Checkpoint evidence:

- a program-introspection test proves exact command/alias/argument/option parity;
- representative CLI invocation tests prove unchanged accepted command lines;
- focused CLI and compatibility tests pass.

## Task 3: Generate discovery and schema from the registry

Files expected:

- Modify: `src/command-contract/registry.ts`
- Modify: `src/commands/commands.ts`
- Modify: `src/commands/schema.ts`
- Modify: `test/command-contract/registry.test.ts`
- Modify/add: schema contract tests

Move schema documents behind the registry and ensure all fifteen stable commands have one resolvable schema. `commands --json` and `schema --json` must project the same definitions without maintaining independent name catalogs. Preserve existing schema shapes exactly; this task does not authorize fixture changes.

Checkpoint evidence:

- registry/schema/discovery parity tests pass;
- v1 command/schema compatibility projections remain byte-shape compatible;
- OpenSpec tasks 3.1, 3.2, 3.3, 3.4, and 3.6 have local implementation evidence but remain unchecked until milestone validation and review.

## Task 4: Registry-driven shortcut global normalization

Files expected:

- Modify: `src/commands/shortcut.ts`
- Modify: `src/cli.ts`
- Modify: `test/commands/shortcut.test.ts`

Define global options once and use the same normalized option metadata for Commander and shortcut parsing. Preserve option ordering before the shortcut target, missing-value errors, structured-output rejection, agent-friendly defaults, transparent agent arguments, and the shortcut install-policy behavior.

Checkpoint evidence:

- exhaustive global-option table tests pass for both normal and shortcut entry paths;
- shortcut execution compatibility and state-read-error tests pass;
- task 3.5 has local implementation evidence.

## Task 5: Explicit presenter routing

Files expected:

- Add: `src/command-contract/presentation.ts`
- Modify: `src/output/index.ts`
- Modify command modules only where required to export their existing human presenter
- Add/modify: output and compatibility tests

Route human, JSON v1, and NDJSON v1 result presentation through an explicit command presenter selected by the registry. Keep one canonical `CommandResult`/`CommandEvent` model, preserve each existing human renderer and structured stream destination, and prevent presenter metadata from entering domain/application layers.

Checkpoint evidence:

- presenter coverage exists for every stable command;
- JSON and NDJSON projections remain unchanged;
- task 3.7 has local implementation evidence.

## Task 6: Milestone validation, review, and PR

Run:

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run openspec:validate
bun run memory:check
bun run build
bun run package:check
```

Also run focused CLI process tests for accepted command lines, aliases, structured schema/discovery, shortcut passthrough, stream separation, and exit codes. Use independent specification and code-quality reviews; fix all Critical/Important findings and repeat affected validation. Only after those checks pass, mark OpenSpec 3.1–3.7 complete, normalize the branch, validate the PR body, push, and open the PR to integration.

## Recovery rule

Resume the first incomplete row in `.superpowers/sdd/progress.md`. Before editing, check `git status`, recent commits, the granular recovery ref, OpenSpec status, and CodeGraph pending-sync state. If a network or quota failure interrupts remote delivery, retain the committed local checkpoint and retry only the failed push/PR/check operation; do not redo completed implementation.
