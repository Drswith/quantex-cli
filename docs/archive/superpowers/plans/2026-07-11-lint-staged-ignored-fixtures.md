# Lint-Staged Ignored Fixture Compatibility Plan

> **For agentic workers:** Use `superpowers:test-driven-development` for the configuration regression and `superpowers:verification-before-completion` before commit, push, or PR claims.

**Goal:** Allow a milestone commit containing only formatter-ignored JSON fixtures in its JSON lint-staged group to pass pre-commit without formatting those fixtures or weakening checks for supported files.

**Architecture:** Keep `.oxfmtrc.json` ignore boundaries unchanged. Add oxfmt's pinned `--no-error-on-unmatched-pattern` option to both lint-staged formatter commands so an all-ignored matched set is a successful no-op; supported staged source still runs through oxfmt and TypeScript/JavaScript still runs through oxlint afterward.

**Delivery:** One process/tooling commit and one PR from `codex/fix-lint-staged-ignored-fixtures` to protected `codex/redesign-lifecycle-integration`. This prerequisite contains no lifecycle engine implementation, does not target `main`, and cannot trigger Release.

## Task 1: Extend the active delivery contract

**Modify:**

- `openspec/changes/support-integration-branch-delivery/proposal.md`
- `openspec/changes/support-integration-branch-delivery/design.md`
- `openspec/changes/support-integration-branch-delivery/specs/code-quality-tooling/spec.md`
- `openspec/changes/support-integration-branch-delivery/tasks.md`

Record the observed pre-commit blocker and the exact no-op behavior for an all-ignored matched set. Preserve `.oxfmtrc.json` ignore patterns and require real formatter/linter failures on supported files to remain blocking. Add one implementation task without changing the redesign change's 74-task denominator.

Also record already verified live setup facts: bootstrap PR #442 merged after all required checks, integration was synchronized to the post-bootstrap main SHA with `0 0` drift, and ruleset `protect-lifecycle-integration` is active.

## Task 2: Add the failing configuration regression

**Create:** `test/lint-staged-config.test.ts`

Assert that:

- `test/fixtures` remains ignored by oxfmt;
- both lint-staged oxfmt commands use `--no-error-on-unmatched-pattern`;
- the TypeScript/JavaScript task still runs `oxlint --fix` after oxfmt;
- the JSON/config task does not add a linter or bypass formatter-supported files.

Run the focused test before changing `package.json`; it must fail because both commands currently omit the option.

## Task 3: Make the minimal lint-staged change

**Modify:** `package.json`

Change both formatter commands from `oxfmt --write` to:

```text
oxfmt --write --no-error-on-unmatched-pattern
```

Do not change `.oxfmtrc.json`, formatter version, lint-staged globs, hooks, or CI commands. Run the focused test and a direct ignored-only oxfmt smoke using `.release-please-manifest.json`.

## Task 4: Validate and deliver

Run:

```bash
bun run test -- test/lint-staged-config.test.ts
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run openspec:validate
bun run memory:check
```

Stage the complete prerequisite diff and create one `chore(tooling)` commit through the normal pre-commit hook. Validate the PR body, push, open a PR to exact integration, wait for the six required contexts plus PR Governance and review, and merge with an ordinary allowed method. Keep both umbrella changes active and report release/archive closure as pending.
