# Proposal: redesign-project-workflow

## Why

A full-repo audit (35 scripts, 5 workflows, 49 process docs, 21 specs, 120 commits of history) shows the project workflow has outgrown its design: the same rules are restated in up to five homes, near-duplicate scripts multiply, required CI gates do not match what actually runs on PRs, and the release train has been in a continuous fix-on-fix loop for 3.5 months (three mechanism redesigns, a same-day revert-and-republish, an accidental v2.0.0 major). Roughly half of the last 120 commits on main are process overhead rather than product work.

The root causes are structural, so this change redesigns the workflow around four principles: **one rule lives in one home**, **every required gate really runs and can fail**, **the release path is exercisable without cutting a real release**, and **every script earns its file**.

## What Changes

- **Consolidate `scripts/` from 35 files to 28** (7 merge groups, 3 new testable scripts):
  - Merge `cargo/deno/uv-lifecycle-smoke.ts` into one parameterized `pm-lifecycle-smoke.ts`.
  - Merge the 4-step `release:artifacts` chain into one `release-artifacts.ts`.
  - Merge `commit-trailer-policy.ts` + `pr-merge-commit-policy.ts` into `commit-policy.ts --mode push|pr`.
  - Merge `test-container.ts` + `test-sandbox.ts` into `test-isolation.ts --backend docker|modal`.
  - Fold `verify-v1-downstream.ts` into its only consumer `verify-package-distribution.ts`.
  - Convert `release-pr-policy.js` + hand-written `.d.ts` to a single TypeScript file.
  - Fold the 6-line `write-agent-catalog-schema.ts` into `write-agent-catalog-manifest.ts`.
  - Add `ci-context.ts`: one script that lists changed files and PR/push commits via `gh api`, replacing three copy-pasted `github-script` YAML blocks.
  - Add `release-candidate.ts`: the whole build-candidate chain as one locally runnable script (CI strict mode / `--local` dry-run mode), so the release path is testable without a real release. Exposed as `bun run release:dry-run`.
  - Add `verify-release-candidate.ts`: absorbs `release.yml`'s inline Node heredocs (candidate hash check, npm state resolution, registry closure polling, asset verification) into a testable script.
- **Make CI gates honest** (`ci.yml`, `sandbox-tests.yml`):
  - `classify` computes files+commits once via `ci-context.ts`; `lint` and `governance` consume its outputs instead of re-calling the GitHub API (removes ~120 lines of duplicated YAML JS).
  - `test (windows-latest)` now runs on PRs when the change is product-impacting (today it never runs on PRs while being a nominally required check).
  - Required checks become `lint`, `governance`, and the three platform test contexts; `sandbox-tests` becomes explicitly advisory (fork PRs silently pass it today while getting zero coverage). **BREAKING (process)**: branch rulesets must be updated to add `governance` and drop `sandbox-tests`.
- **Make the release train deterministic** (`release-please.yml`, `release.yml`):
  - Rename the `tag-release-backstop` job/script to `tag-release` (`ci:tag-release`): tagging after a manually merged Release PR is the designed mechanism, not a backstop. Remove the dead `if: github.event_name == 'push'` guard.
  - Guarantee exactly one `release.yml` trigger: the tag is pushed with `git push` under the GitHub App token (which fires `on: push: tags`), and the redundant `workflow_dispatch` fan-out is removed, eliminating the double-fire.
  - `release.yml` build-candidate collapses to `bun run release:candidate`; publish-side inline Node heredocs move to `verify-release-candidate.ts` subcommands.
  - `release-pr-policy` rejects unannounced major version bumps (root cause of the accidental v2.0.0).
- **Give every rule one home** (docs):
  - Delete `docs/sessions/2026-04-28-oxlint-oxfmt-migration.md` (raw transcript, orphaned, violates the sessions no-transcripts policy).
  - Delete `docs/runbooks/quantex-task-start.md`; its content is the runtime skill's Task Start Entry (single home).
  - Shrink `docs/github-collaboration.md` to GitHub-surface topics only (templates, labels, discussion funnel, rulesets); process rules point to `skills/quantex-agent-runtime/SKILL.md`.
  - Merge `skills/quantex-cli/references/automation-playbook.md` into `output-contracts.md`.
  - Trim `AGENTS.md` gate text to pointers (runtime skill stays the process source of truth).
  - Single-source the three agent-runtime bootstrap stubs (`.agents/`, `.codex/`, `.github/`) from one template and enforce byte-parity in `memory:check` (today `.github`'s stub has already drifted).
- **Consolidate OpenSpec specs from 21 to 17**:
  - Merge `release-governance`, `release-note-input`, `core-npm-release` into `release-workflow`.
  - Merge `ci-platform-coverage` into `code-quality-tooling`.
  - Reframe `core-installation-soak` as `installation-routing`: the soak time-box language is stale at 1.8.x, but the routing contract it carries (`QUANTEX_INSTALLATION_ENGINE=legacy` override, dry-run compatibility route) is still live behavior and is preserved without the freeze framing.
  - De-duplicate `project-memory` (the root-markdown allowlist requirement is stated twice) and keep it as durable policy; operational prose lives in the runtime skill.
  - Slim `openspec/config.yaml` context so gate text lives only in the runtime skill.
- **Fix the local validation chain**:
  - Add `bun run setup` (explicit `simple-git-hooks` install) because `bunfig.toml` `ignoreScripts=true` silently disables `prepare` — today the installed hooks are stale and never run the current validation set.
  - `pre-commit` drops the per-commit `bun install --frozen-lockfile` and uses `bunx lint-staged` instead of `npx`.
  - Remove the dead `test:readonly-smoke` package script (its vitest files run under the default `test` glob).
- **Archive the completed change** `fix-release-tag-automation` (merged, released in 1.8.2, spec deltas already synced) as part of this cleanup.
- Add ADR 0009 recording this redesign and the required-checks change.

## Capabilities

- **New Capabilities**: none.
- **Modified Capabilities**:
  - `release-workflow` — absorbs the three sibling release specs; tag-release mechanism, release-candidate pipeline, dry-run, major-bump guard.
  - `release-governance` — requirements move into `release-workflow`; capability removed.
  - `release-note-input` — requirements move into `release-workflow`; capability removed.
  - `core-npm-release` — requirements move into `release-workflow`; capability removed.
  - `code-quality-tooling` — absorbs `ci-platform-coverage`; hooks/setup contract updated.
  - `ci-platform-coverage` — requirements move into `code-quality-tooling`; capability removed.
  - `project-memory` — de-duplicated; stays the durable policy contract.
  - `core-installation-soak` — removed; routing contract moves to the new `installation-routing` capability.
  - `installation-routing` (new) — soak-free restatement of the live Core/legacy routing contract.

## Impact

- `scripts/` (13 files removed/merged, 3 added), `package.json` scripts + hooks, `bunfig.toml` (unchanged; hooks documented), `.github/workflows/{ci,release,release-please,sandbox-tests}.yml`
- `openspec/specs/` (5 capabilities removed/merged, 2 rewritten), `openspec/config.yaml`, `openspec/changes/fix-release-tag-automation/` (archived)
- `AGENTS.md`, `docs/README.md`, `docs/github-collaboration.md`, `docs/releases.md`, `docs/runbooks/*`, `docs/adr/0009-*` (new), `docs/sessions/` (1 deletion), `skills/quantex-cli/references/`
- `.agents/`, `.codex/`, `.github/skills/` bootstrap stubs + `scripts/check-project-memory.ts` parity check
- Tests referencing merged scripts or spec names: `test/{lifecycle-smoke,path-taxonomy,pr-governance,commit-trailer-policy,pr-merge-commit-policy,release-pr-policy,pr-body-policy}.test.ts` and new tests for `ci-context`, `release-candidate`, `verify-release-candidate`
- Out of scope (non-goals): product CLI behavior, agent catalog content, the `packages/core` SDK surface, README product tables, branch ruleset settings themselves (documented for the maintainer to apply).

## Intake classification

Durable-process and workflow redesign (project memory policy, durable workflow, OpenSpec rules, GitHub collaboration flow); OpenSpec required.
