# Lifecycle Spec Sync and Archive Closure Plan

Base: `origin/main@5e0911b02bb84a5909b8e850fdc02276b1c0b759`

## Goal

Synchronize the accepted durable lifecycle redesign and delivery-process contracts into `openspec/specs/`, then archive `redesign-lifecycle-engine` and `support-integration-branch-delivery` through one protected-`main` pull request. Do not restore the retired integration topology and do not publish another `0.x` release.

## Earned state

- The lifecycle redesign reached `74/74`, was promoted, and was published as the final `0.x` baseline `v0.29.1`.
- Cleanup PR #472 and external-teardown PR #473 rebase-merged.
- The temporary integration ruleset and remote integration ref are absent.
- `main@5e0911b02bb84a5909b8e850fdc02276b1c0b759` passed CI run 29497063257 and Sandbox Tests run 29497063263.
- Release run 29497287375 classified the #473 merge but skipped GitHub Release creation, npm publishing, and artifact upload.

## Task 1: Synchronize durable current specs

- Add current specifications for the command-contract registry, compatibility shell, and lifecycle reconciliation core.
- Merge accepted provider binding, uninstall, update, idempotency, state, and self-upgrade requirements into their existing current specs.
- Preserve the durable formatter no-op, umbrella archive timing, task-progress archive guard, and rebase-first/squash-second policy.
- Exclude the retired integration ref, temporary ruleset, temporary CI targets, and temporary multi-commit topology exceptions.
- Run `bun run openspec:validate`, `bun run memory:check`, `bun run lint`, `bun run format:check`, and `bun run typecheck` before marking support task 5.4 complete.

## Task 2: Prepare archive execution and post-merge verification

The archive owner is the active Codex agent in this worktree. After tasks 5.4–5.6 are complete, execute this separately resumable command from a clean branch state:

```bash
bun run openspec:archive-closure -- --body-file .tmp/lifecycle-archive-pr.md --title "docs(openspec): archive lifecycle redesign" redesign-lifecycle-engine support-integration-branch-delivery
```

The wrapper must confirm `74/74` and `30/30`, archive both changes with `--skip-specs` because current specs are already synchronized, validate the resulting OpenSpec tree, and generate the PR body. Validate that body again before delivery:

```bash
bun run pr:body:check -- --body-file .tmp/lifecycle-archive-pr.md --title "docs(openspec): archive lifecycle redesign"
```

Then run lint, format check, typecheck, OpenSpec validation, memory check, and `git diff --check`; commit once, push, and create a Ready PR to `main`. Keep auto-merge disabled and merge manually with rebase first after every required context passes.

## Task 3: Verify external archive closure after merge

After the archive PR merges, the same owner must refresh `origin/main` and verify:

```bash
bun run openspec:list
bun run openspec:validate
bun run memory:check
git status --short
```

Expected state:

- neither lifecycle change appears in the active change list;
- dated archive directories exist for both changes and retain their complete task ledgers;
- the working tree is clean;
- post-merge main CI and Sandbox Tests pass;
- Release classifies the archive-only commit without creating a GitHub Release, publishing npm, or uploading artifacts;
- GitHub Release and npm `latest` remain `0.29.1` until the separately governed `1.1.0` graduation change is delivered.

Report promotion, `v0.29.1` release, integration teardown, current-spec synchronization, archive PR merge, archive state verification, and the pending `1.1.0` graduation as distinct closure states.
