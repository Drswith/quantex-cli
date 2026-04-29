## Context

Quantex already documents a broader validation contract in `AGENTS.md` than the repository enforces before code reaches CI. Today, local hooks stop at staged-file formatting and lint fixes, while merge-gating CI and PR governance each embed their own path classifier logic. That creates three failure modes:

1. Critical repository checks first fail in CI instead of at push time.
2. Scope classification can drift between CI and governance because the same taxonomy lives in multiple YAML files.
3. Process-only changes currently preserve required matrix contexts without exercising any build step, which weakens the signal behind the green checks.

This is a cross-cutting workflow change because it touches local hooks, repository scripts, merge-gating CI, and PR governance together.

## Goals / Non-Goals

**Goals:**

- Move high-value repository checks left to `pre-push` without making `pre-commit` run the full repository validation surface.
- Establish one repository-native path taxonomy that CI and PR governance can both consume.
- Preserve the current scoped-CI optimization for process-only changes while adding a small execution guardrail.
- Keep the implementation Bun/TypeScript-native and easy to call from GitHub Actions.

**Non-Goals:**

- Redesign the release-please two-phase release workflow.
- Eliminate archive PR automation or change release/archive concurrency topology.
- Expand formatting coverage to Markdown or introduce new third-party linters/formatters.
- Run the full cross-platform test matrix for process-only changes.

## Decisions

### Decision: introduce a shared TypeScript path-taxonomy script

We will add a repository script that exposes the canonical product-impacting/process-only rules and can classify an arbitrary file list. GitHub Actions and local scripts will call this file instead of duplicating prefix/file-set logic inline.

Why this over “keep the YAML copies but document them better”:

- Documentation already exists and has not prevented drift.
- TypeScript can be unit-tested and reused locally.
- A repo-native script makes future taxonomy changes a single-diff operation.

### Decision: add `pre-push` instead of widening `pre-commit`

We will keep `pre-commit` focused on staged-file formatting/lint fixes and add a new `pre-push` hook for `format:check`, `typecheck`, `openspec:validate`, and `memory:check`.

Why this over moving everything into `pre-commit`:

- `pre-commit` should stay fast and file-scoped so routine commits remain lightweight.
- `typecheck` and OpenSpec/project-memory validation are repository-wide checks, which fit the push boundary better.
- This catches the highest-value CI failures earlier without turning every commit into a full validation run.

### Decision: keep process-only matrix skipping, but require a minimal Ubuntu build

Process-only changes will continue to skip the expensive three-platform test execution, but CI will no longer report a pure no-op matrix success. Instead, the process-only path will run `bun run build` on Ubuntu as a lightweight execution guard.

Why this over restoring the full matrix for process-only changes:

- The goal is to preserve most of the scoped-CI cost savings.
- A minimal build provides real execution signal for workflow/docs/OpenSpec changes that could still break repository wiring.

### Decision: PR governance consumes classifier output, not its own path rules

PR governance will call the shared classifier to determine whether a PR is process-only or product-impacting for release-intent enforcement.

Why this over embedding the script output into generated YAML variables ahead of time:

- Direct invocation keeps the workflow simpler.
- It avoids a second transformation layer that could itself drift.

## Risks / Trade-offs

- [Pre-push becomes slower] → Keep the hook limited to four repository-wide checks and leave tests/builds in CI.
- [Script output shape becomes another contract] → Keep the JSON surface intentionally small and add focused tests around classification behavior.
- [Process-only build still misses platform-specific regressions] → Accept this as a scoped P0 trade-off; the full matrix remains required for product-impacting changes.
- [Workflow shell glue becomes brittle] → Use Bun/TypeScript for classification and keep the YAML side thin.
