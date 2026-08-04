# Design: redesign-project-workflow

## Approach

The redesign applies four principles everywhere: one rule lives in one home, every required gate really runs and can fail, the release path is exercisable without cutting a real release, and every script earns its file. Existing strong pieces (immutable release-candidate hand-off, path taxonomy, PR body policy, OpenSpec as contract source of truth, the runtime skill as process home) are kept; duplication and drift around them are removed.

## Script consolidation

Seven merge groups collapse `scripts/` from 35 files to 28:

| Surviving file | Absorbs | Shape |
|---|---|---|
| `pm-lifecycle-smoke.ts` | `cargo-`, `deno-`, `uv-lifecycle-smoke.ts` | Per-manager config table (install type, package name, args); selected by argv |
| `release-artifacts.ts` | `compress-release-binaries.ts`, `write-release-checksums.ts`, `generate-release-manifest.ts`, `verify-release-artifacts.ts` | One sequential pipeline, previously only ever chained |
| `commit-policy.ts` | `commit-trailer-policy.ts`, `pr-merge-commit-policy.ts` | `--mode push\|pr`; shared trailer pattern and commit-JSON parsing live once |
| `test-isolation.ts` | `test-container.ts`, `test-sandbox.ts` | `--backend docker\|modal`; shared runner, backend-specific availability checks |
| `verify-package-distribution.ts` | `verify-v1-downstream.ts` | Folded as a final verification step of its only consumer |
| `release-pr-policy.ts` | `release-pr-policy.js` + hand-written `.d.ts` | TypeScript like every other policy script |
| `write-agent-catalog-manifest.ts` | `write-agent-catalog-schema.ts` | Schema write becomes one generation step |

`scripts/path-taxonomy.ts` `sandboxRelevantFiles` and all test/package.json/workflow references are updated to the surviving names in the same change.

Three scripts are added, each replacing untestable or duplicated logic:

- `ci-context.ts` — lists changed files (PR `listFiles` / push `compare`) and commits (PR commits / push compare) via `gh api`, emitting both as step outputs. Imports only Node builtins so the `classify` job needs no `bun install`. Replaces three copy-pasted `github-script` blocks in `ci.yml`/`sandbox-tests.yml`.
- `release-candidate.ts` — the entire build-candidate chain (seal contract → build → build:bin → artifacts → smoke → package checks → stage → verify) as one script with two modes: default CI-strict, and `--local` for `bun run release:dry-run` (skips GitHub-identity validations, allows a dirty tree). `release.yml`'s build-candidate job becomes checkout + setup + this script + upload, so CI and local run the same definition. This closes the audit's root cause: the release path was previously only exercisable by cutting a real release.
- `verify-release-candidate.ts` — absorbs `release.yml`'s inline Node heredocs as subcommands: `download-check` (hash/size of the downloaded candidate), `npm-state` (registry publication state), `assets-check` (GitHub Release assets match candidate), `registry-closure` (poll until registry integrity converges). YAML keeps only native `gh`/`npm` one-liners.

## CI gates

`ci.yml`:

- `classify` runs `ci-context.ts` then `path-taxonomy.ts` once, exporting `changed_files`, `commits_json`, `scope`, `run_test_matrix`, `sandbox_relevant`.
- `lint` consumes `needs.classify.outputs` (no API re-listing): commit policy (mode by event), memory check, OpenSpec validate, lint, format check, typecheck.
- `governance` (PR only) consumes the same outputs: release-PR policy (release-please branches), PR body policy, commit policy `--mode pr`.
- `test (windows-latest)` drops `github.event_name != 'pull_request'`; all three platform jobs gate PRs when the change is product-impacting.

Required checks (target ruleset, documented for the maintainer): `lint`, `governance`, `test (ubuntu-latest)`, `test (macos-latest)`, `test (windows-latest)`. `sandbox-tests` becomes explicitly advisory: fork PRs skip it for lack of secrets and a skipped required check silently passes, so it never actually gated — the label now matches reality. `sandbox-tests.yml` keeps its triggers and fail-safe classification, sharing `ci-context.ts`.

## Release train

release-please stays (`skip-github-release: true`): it opens Release PRs; it never tags.

Tagging becomes a designed step, not a backstop: the `tag-release` job (renamed from `tag-release-backstop`, script `scripts/tag-release.ts`, package script `ci:tag-release`) runs after release-please on protected-branch push. When branch head is a release commit, manifest version has no tag, and the push CI run succeeded, it creates and pushes the tag **with `git push` under the GitHub App token**, which reliably fires `release.yml`'s `on: push: tags` trigger, then relabels the Release PR. The redundant `workflow_dispatch` fan-out is removed — exactly one trigger path, no double-fire. The dead `if: github.event_name == 'push'` guard is removed.

`release-pr-policy` gains a major-bump guard: a Release PR whose target version is a major bump is rejected unless the PR body carries an explicit `Release-As: <major>` override block, closing the accidental-v2.0.0 path.

`release.yml` keeps its two-job shape (build-candidate → publish) and immutable-candidate contract; step bodies move into the scripts above. `release-core.yml` stays manual and separate; the releasing runbook documents that a Core release must precede any CLI release that depends on a new Core version.

## Documentation single-homing

- Runtime skill (`skills/quantex-agent-runtime/SKILL.md`) remains the sole full process text. `AGENTS.md` keeps mission, red lines, validation triggers, and pointers; duplicated gate prose becomes one-line pointers.
- `docs/github-collaboration.md` shrinks to GitHub-surface topics (templates, labels, discussion funnel, required-checks table); closure labels, PR-body preflight, worktree rules, and release prose are removed in favor of pointers.
- `docs/runbooks/quantex-task-start.md` is deleted (verbatim duplicate of the skill's Task Start Entry); referencers point at the skill.
- `skills/quantex-cli/references/automation-playbook.md` merges its unique content into `output-contracts.md` and is deleted.
- `docs/sessions/2026-04-28-oxlint-oxfmt-migration.md` is deleted (raw transcript; violates the sessions no-transcripts policy; orphaned).
- The three runtime bootstrap stubs (`.agents/`, `.codex/`, `.github/skills/`) are generated from one canonical template `skills/quantex-agent-runtime/bootstrap-stub.md`; `memory:check` asserts byte parity so they cannot drift again.

## OpenSpec consolidation

- `release-workflow` absorbs `release-governance`, `release-note-input`, and `core-npm-release`: one release contract covering the train, Release PR governance, note input format, and Core publication.
- `code-quality-tooling` absorbs `ci-platform-coverage`: one contributor contract covering local validation, hooks, CI matrix, honest skip semantics, and required checks.
- `core-installation-soak` is reframed as `installation-routing`: the 1.5 soak time-box and freeze language are stale at 1.8.x, but the routing contract (`QUANTEX_INSTALLATION_ENGINE=legacy` whole-invocation override, dry-run compatibility route, no mid-invocation engine switching) is still live behavior in `src/commands/installation-routing.ts` and is preserved without the time-box.
- `project-memory` is de-duplicated (the root-markdown allowlist requirement appears twice today) and remains the durable policy contract; operational prose stays in the runtime skill.
- `openspec/config.yaml` context stops restating gate prose and points to the runtime skill.

Spec merges are applied in place under `openspec/specs/` as tasks of this change; the change's spec deltas record requirement movement for review, and archive closure later uses the skip-specs path. The completed `fix-release-tag-automation` change is archived as part of this cleanup.

## Local validation chain

- `bun run setup` runs `simple-git-hooks` explicitly; contributing docs tell developers to run it once after `bun install`. This fixes the silent drift where `bunfig.toml` `ignoreScripts=true` disables `prepare`, leaving stale hooks that never ran the current validation set.
- `pre-commit` becomes `bunx lint-staged` only (no per-commit `bun install --frozen-lockfile`, no `npx` in a Bun-first repo).
- `pre-push` keeps mirroring CI (lint, format:check, typecheck, openspec:validate, memory:check).
- Dead `test:readonly-smoke` entry is removed; its vitest files already run under the default `test` glob.

## Testing

- Renamed/merged scripts keep their existing vitest coverage, updated to new entry points: lifecycle smoke (parameterized), commit policy (both modes), path taxonomy (new sandbox-relevant names), PR governance, release-PR policy (plus new major-bump guard cases).
- New tests: `ci-context.test.ts` (event-shape parsing and output writing, gh api mocked), `release-candidate.test.ts` (mode gating, step ordering, local vs CI strictness), `verify-release-candidate.test.ts` (hash checks, npm-state parsing, closure polling), stub-parity coverage inside the memory-check test.
- `openspec:validate` and `memory:check` must pass with the merged specs and deleted docs.

## Risks

- **Ruleset drift**: required checks live in GitHub settings, not the repo. Mitigation: ADR 0009 + releasing runbook carry the exact target list, and the PR body calls out the one-time maintainer action.
- **Job renames breaking required checks**: job display names (`lint`, `governance`, `test (...)`) are unchanged; only the backstop job is renamed, and it was never a required check.
- **Release behavior change**: the first release after merge is the live exercise of the new tag path. Mitigation: `release:dry-run` covers the artifact chain locally; the tag path itself is unit-tested; the release runbook keeps the manual tag fallback.
- **Spec merge churn**: four capability names disappear; inbound references (AGENTS.md, docs, tests) are updated in the same change and guarded by `openspec:validate` + `memory:check`.
