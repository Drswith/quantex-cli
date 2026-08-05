# Proposal: align-governance-gates

## Why

A failure audit of ~130 CI runs since 2026-07-16 shows governance gates are the single largest source of CI failures — roughly 53 occurrences, ahead of Windows tests (30) and the release pipeline (13). Two structural defects account for almost all of them, and neither is a policy disagreement: in both cases the contributor is following the documented process and still fails.

**The shipped PR template does not satisfy the PR body policy that guards it.** `openspec/specs/release-workflow/spec.md` requires that a PR body be written "based on `.github/pull_request_template.md`", but the template ships with an empty `## Linked Artifacts` section, and `validatePrBodyPolicy` rejects a body with no meaningful linked artifact. GitHub auto-populates that template into every new pull request, so every contributor starts from a state the validator rejects and can only discover the extra requirement by failing CI. This is reproducible today:

```
bun run pr:body:check -- --body-file .github/pull_request_template.md --title "chore: some change"
-> PR body must link at least one issue, ADR, OpenSpec artifact, or discussion
```

Observed failures include both halves of this: bodies written from scratch that omit required sections, and bodies copied from the template that fail the linked-artifact check.

**The commit-author gate has no local counterpart.** The dominant governance failure message is `uses author metadata that can be re-emitted as a Co-authored-by trailer by GitHub squash merge` — the commit's *author identity* (for example `cursoragent@cursor.com` or a `[bot]@users.noreply.github.com` address), not a trailer in the message. The existing `commit-msg` hook only rewrites message text, so by construction it cannot catch this; `code-quality-tooling` deliberately scopes that hook to Cursor's trailer formats only. The result is that a branch passes every local hook and is rejected only after a full CI round trip, at which point the fix requires re-authoring commits and force-pushing.

Both defects share one shape: **a rule that is only enforced remotely, against inputs that are already knowable locally.**

## What Changes

- **Make the PR template satisfy its own validator.** Restate `## Linked Artifacts` using the option-list style the template already uses for `## Release Intent` (list the applicable forms, delete the ones that do not apply), so the shipped template passes `validatePrBodyPolicy` unmodified while still requiring the author to make a real declaration. The intake classification that `AGENTS.md` already requires of every PR becomes a first-class line rather than tribal knowledge.
- **Lock template/validator consistency with a test.** Add regression coverage asserting that the shipped `.github/pull_request_template.md` passes `validatePrBodyPolicy`, that it contains every entry of `requiredPrBodyHeadings`, and that both release-please `pull-request-header` templates still pass. Today nothing prevents an edit to either side from silently re-breaking the other; this converts a recurring discover-by-CI-failure into a build-time guarantee.
- **Give the commit policy a local mode.** Add `--mode local` to `scripts/ci/commit-policy.ts`, which resolves the commits on the current branch and runs the *same* `validatePullRequestMergeCommitPolicy` function that CI runs, and wire it into the `pre-push` hook. Because both paths call one shared validator, local and remote cannot drift. A contributor learns about a bot author identity or a prohibited trailer in under a second, before pushing, instead of after a CI round trip.
- Document the required author identity for agent-driven sessions so the gate is satisfiable by configuration rather than by after-the-fact re-authoring.

Out of scope, recorded for follow-up rather than folded in: relaxing the single-commit rule to fire only on multiple distinct author identities, the Windows `ci-context` test flake, release seal-contract title matching, and moving `sandbox-tests` off per-PR triggering.

## Capabilities

- **New Capabilities**: none.
- **Modified Capabilities**:
  - `release-workflow` — the PR template is required to satisfy PR body governance, and that agreement is regression-tested.
  - `code-quality-tooling` — `pre-push` gains local commit-policy enforcement sharing the CI validator; the `commit-msg` hook's Cursor-only scope is unchanged and explicitly complemented rather than replaced.

## Impact

- `.github/pull_request_template.md`
- `scripts/ci/commit-policy.ts`, `package.json` (`pre-push` hook)
- `test/pr-body-policy.test.ts`, `test/commit-policy.test.ts`
- `openspec/specs/release-workflow/spec.md`, `openspec/specs/code-quality-tooling/spec.md`
- Contributor-facing docs covering local validation and author identity

No CLI behavior, structured output, agent catalog, config, state, or release-artifact surface changes.

## Intake classification

Durable-process and governance-contract change affecting GitHub collaboration flow and the local validation chain; OpenSpec required.
