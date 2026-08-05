# Tasks

## 1. Script consolidation

- [x] Merge `cargo/deno/uv-lifecycle-smoke.ts` into `scripts/pm-lifecycle-smoke.ts` (config table, argv-selected); update `scripts/lifecycle-smoke.ts`, `scripts/path-taxonomy.ts`, `test/lifecycle-smoke.test.ts`, `test/path-taxonomy.test.ts`
- [x] Merge `compress-release-binaries.ts` + `write-release-checksums.ts` + `generate-release-manifest.ts` + `verify-release-artifacts.ts` into `scripts/release-artifacts.ts`; update `package.json` `release:artifacts`
- [x] Merge `commit-trailer-policy.ts` + `pr-merge-commit-policy.ts` into `scripts/commit-policy.ts --mode push|pr`; update package scripts, `ci.yml`, and both test files
- [x] Merge `test-container.ts` + `test-sandbox.ts` into `scripts/test-isolation.ts --backend docker|modal`; update package scripts, `sandbox-tests.yml`, runbook
- [x] Fold `verify-v1-downstream.ts` into `verify-package-distribution.ts`
- [x] Convert `release-pr-policy.js` + `.d.ts` to `scripts/release-pr-policy.ts`; add major-bump guard (reject unless `Release-As` override declared); update tests
- [x] Fold `write-agent-catalog-schema.ts` into `write-agent-catalog-manifest.ts`; update `agent-catalog:generate`
- [x] Remove dead `test:readonly-smoke` package script

## 2. New testable scripts

- [x] Implement `scripts/ci-context.ts` (gh api files+commits, builtins-only) + `test/ci-context.test.ts`
- [x] Implement `scripts/release-candidate.ts` (CI-strict default, `--local` dry-run) + `release:dry-run` package script + `test/release-candidate.test.ts`
- [x] Implement `scripts/verify-release-candidate.ts` (download-check, npm-state, assets-check, registry-closure) + `test/verify-release-candidate.test.ts`

## 3. CI workflows

- [x] `ci.yml`: classify via `ci-context.ts`; lint + governance consume classify outputs (delete duplicated github-script blocks); windows test runs on PRs
- [x] `sandbox-tests.yml`: classify via `ci-context.ts`; header comment marks it advisory
- [x] `release-please.yml`: rename job to `tag-release`, drop dead `if`, single-fire via `git push` tag (no workflow_dispatch)
- [x] Rename `scripts/release-tag-backstop.ts` → `scripts/tag-release.ts` (`ci:tag-release`); assert git-push tagging in tests
- [x] `release.yml`: build-candidate collapses to `bun run release:candidate` + upload; publish heredocs become `verify-release-candidate.ts` subcommand calls

## 4. Docs single-homing

- [x] Delete `docs/sessions/2026-04-28-oxlint-oxfmt-migration.md`
- [x] Delete `docs/runbooks/quantex-task-start.md`; point referencers at the runtime skill
- [x] Shrink `docs/github-collaboration.md` to GitHub-surface topics + pointers
- [x] Merge `automation-playbook.md` into `output-contracts.md`; update `skills/quantex-cli/SKILL.md`
- [x] Trim `AGENTS.md` gate prose to pointers
- [x] Single-source bootstrap stubs from `skills/quantex-agent-runtime/bootstrap-stub.md`; extend `memory:check` with stub byte-parity
- [x] Update `docs/README.md`, `docs/runbooks/README.md`, `docs/releases.md`, `docs/runbooks/releasing-quantex.md`, `docs/runbooks/modal-sandbox-testing.md`, `docs/runbooks/release-and-self-upgrade-debugging.md` for renamed scripts and the new release flow
- [x] Add `docs/adr/0009-workflow-v2.md`

## 5. OpenSpec consolidation

- [x] Merge `release-governance` + `release-note-input` + `core-npm-release` into `openspec/specs/release-workflow/spec.md`; delete the three directories
- [x] Merge `ci-platform-coverage` into `openspec/specs/code-quality-tooling/spec.md` (with honest-gates update); delete `ci-platform-coverage`
- [x] Reframe `core-installation-soak` as `openspec/specs/installation-routing/spec.md` (routing contract without the soak time-box); delete `core-installation-soak`
- [x] De-duplicate `openspec/specs/project-memory/spec.md` (remove the second root-markdown allowlist requirement)
- [x] Slim `openspec/config.yaml` context to pointers
- [x] Update spec-name references in `AGENTS.md`, docs, issue templates, tests
- [x] Archive `fix-release-tag-automation` via `bun run openspec:archive-closure`

## 6. Local chain

- [x] Add `setup` package script (`simple-git-hooks`); document post-install step
- [x] `pre-commit` → `bunx lint-staged` only
- [x] Clean stale `.vscode` extension mapping if present

## 7. Validation and delivery

- [x] `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] `bun run test`
- [x] `bun run openspec:validate`, `bun run memory:check`
- [x] `bun run build`, `bun run release:dry-run` (new harness smoke)
- [x] Commit, push, PR with `pr:body:check`-validated body noting the required-checks maintainer action
