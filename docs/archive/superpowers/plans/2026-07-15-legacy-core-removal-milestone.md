# Typed Outcomes and Legacy Core Removal Milestone

Base: `origin/codex/redesign-lifecycle-integration@05409ecfec3df9b2f708dd1482b5d77d72143ae6`

Branch: `codex/redesign-legacy-removal`

OpenSpec change: `redesign-lifecycle-engine`

## Goal

Complete OpenSpec tasks 2.4 and 10.4-10.6. Make typed lifecycle/provider outcomes the only internal mutation contract used by default install, ensure, uninstall, update, and execution preflight routes; remove migration-only command lifecycle implementations after structural and compatibility gates prove they are unreachable; retain the exact v1 command, state, exit, package-root, and binary contracts behind the compatibility facade.

This milestone is expected to move the active change from 64/74 to 68/74. Tasks 11.1-11.6 remain final integration-promotion closure work and are not completed merely because this milestone runs its own required validation.

## Boundaries

- Preserve the maintained root value/type exports, including the boolean-shaped package-manager APIs. New typed internals must not expand the root facade.
- Preserve stable command names, aliases, arguments/options, human/JSON/NDJSON v1 output, exit meanings, stdout/stderr behavior, state/config projection, transparent child IO, and the `qtx`/`quantex` entry points.
- Remove only implementations proven unreachable from every default command route. Keep compatibility presenters, v1 state projection, aliases, fixtures, and root-facade wrappers.
- Keep future root-export removal outside `redesign-lifecycle-engine`; it requires a separately approved deprecation proposal.
- Do not broaden Quantex into workflow orchestration, batch, daemon, apply, or MCP-server work.
- Keep `redesign-lifecycle-engine` active. Do not synchronize current specs, archive the change, or perform release closure before the final integration-to-main promotion.

## Delivery model

1. Commit each reviewed task as a granular recovery checkpoint.
2. Preserve the final granular head at `refs/quantex/recovery/redesign-legacy-removal-granular`.
3. Rebase on the latest `origin/codex/redesign-lifecycle-integration` before delivery.
4. Normalize to one review commit immediately before a ready PR to `codex/redesign-lifecycle-integration`.
5. Require full local gates, independent specification and quality reviews, all required remote checks, and rebase merge. Never enable auto-merge.

## Task 1: Prove and inventory the remaining legacy default routes

Files expected:

- Add/modify: focused structural and behavioral tests
- Modify: `.superpowers/sdd/progress.md`

Add failing evidence for the remaining gaps before changing implementation: default install/ensure/execution preflight must not resolve observations through the legacy inspection service; default provider mutations must not collapse command results to booleans; and migration-only shadow planning must have no production caller. Record the compatibility APIs that intentionally remain as facade wrappers.

## Task 2: Introduce typed internal mutation outcomes

Files expected:

- Add/modify: lifecycle mutation outcome types and executors
- Modify: `src/package-manager/index.ts`
- Modify: provider adapter mutation dependencies
- Add/modify: unit and provider-conformance tests

Replace internal `{ success: boolean }` and raw boolean mutation flow with discriminated typed outcomes carrying cancellation, timeout, unsupported/unavailable, retryability, command/exit evidence, verification, and remediation where applicable. Keep existing root-exported package-manager signatures as thin v1 compatibility wrappers which map typed outcomes back to their established shapes.

## Task 3: Migrate default observation and installation paths

Files expected:

- Modify: `src/commands/ensure.ts`
- Modify: `src/commands/install.ts`
- Modify: lifecycle execution production wiring
- Modify: lifecycle installation reconciliation
- Add/modify: focused command and lifecycle tests

Resolve mutation and execution preflight state through the new lifecycle observation service. Pass domain-relevant observation data into reconciliation and defer `AgentInspection` projection to compatibility/surface code only. Preserve all v1 presenters, exit mappings, install guidance, receipt behavior, cancellation, timeout, dry-run, and non-interactive semantics.

## Task 4: Remove unreachable migration-only lifecycle code

Files expected:

- Delete: `src/lifecycle/shadow-planning.ts` and obsolete tests/exports
- Delete or rename: legacy mutation-operation bridges after default adapters stop using them
- Modify: stale legacy-path comments and imports
- Add/modify: structural no-import tests

Remove only code that the route inventory and tests prove is no longer reachable. Retain low-level compatibility functions used by the root facade and smoke tests; they must delegate inward to typed execution rather than remain an alternate default lifecycle.

## Task 5: Update verified product and generated references

Files expected:

- Modify: product-facing README/docs generated from the verified registry/catalog source
- Modify: OpenSpec task state after all behavior gates pass

Describe the verified default architecture and compatibility boundary without promising future removal. Regenerate command/catalog references from their existing generators rather than editing generated output as source of truth. Explicitly record that root-export removal is outside this change and requires a separate deprecation proposal.

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
bun run build:bin
bun run package:check
bun run release:artifacts
```

Also run focused provider-conformance, lifecycle mutation, execution preflight, full v1 compatibility, built downstream-consumer, and package-local binary gates. Use independent specification and code-quality reviews; fix every Critical/Important finding and repeat affected validation. Only then mark OpenSpec 2.4 and 10.4-10.6 complete, preserve the recovery ref, rebase integration, normalize the branch, validate the PR body, and create the ready PR to integration.

## Recovery rule

Resume the first incomplete row in `.superpowers/sdd/progress.md`. Before editing, inspect `git status`, recent commits, the granular recovery ref, OpenSpec status, and the CodeGraph pending-sync banner. If tests, runners, network, or quota interrupt progress, retain the last committed checkpoint and split the next change into a smaller independently validated checkpoint. Retry only the failed validation or remote operation.
