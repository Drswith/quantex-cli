# Proposal: remove-author-governance

## Why

The repository enforces three linked rules whose only purpose is keeping `Co-authored-by` trailers out of `main`: newly introduced commits may not contain the trailer, a pull request may not carry a commit authored by a bot or agent identity, and a non-release pull request may not contain more than one commit. The archived `block-coauthored-by-trailers` proposal records the original motivation — merged history had picked up trailers that did not match the project's intended authorship policy, and remediation was expensive because it was only discovered after merge and required force-pushing a protected branch.

The measurement does not support keeping them.

**They are the largest source of CI failures.** Across roughly 130 runs since 2026-07-16, governance steps account for about 53 failures, ahead of Windows tests (30) and the release pipeline (13). The most frequent single message is `uses author metadata that can be re-emitted as a Co-authored-by trailer by GitHub squash merge`.

**They do not achieve their goal.** The trailer rule has been enforced since 2026-05-04, and `main` has accepted at least nine commits carrying a real `Co-authored-by:` trailer since — `fix(lifecycle): clear tracked script/binary uninstall state (#497)`, `docs(openspec): archive remove-superpowers-runtime (#499)`, `chore: release 1.6.0 (#538)`, and `chore: release 1.7.1` among them. The trailers that land credit the maintainer's own GitHub noreply identity and the repository's own release bot. They are added by GitHub at merge time — squash attribution with `squash_merge_commit_message=COMMIT_MESSAGES`, and web-UI operations — which a check that reads the pull request's branch commits structurally cannot observe.

So the gates reject the branch commits an agent authored, while the trailers that actually reach `main` come from the merge itself and pass untouched. The cost is a recurring merge-blocking failure; the benefit is not realized.

The single-commit rule has no independent justification. It was added two days after the trailer rule (`ci: block squash coauthor trailer risk before merge`) purely to prevent GitHub from synthesizing trailers when squashing a multi-author branch, and its own failure message says so. Removing the trailer policy leaves it defending nothing.

## What Changes

- **Remove the commit trailer policy.** `validateCommitTrailerPolicy` and the `Validate commit trailer policy` step in the `lint` job of `ci.yml` are deleted.
- **Remove the commit author identity policy.** `validateCommitAuthorPolicy` and its risky-identity patterns are deleted, along with the local `--mode local` pre-push enforcement added by `align-governance-gates` before that change was archived.
- **Remove the single-commit rule.** Pull requests may again contain more than one commit.
- **Remove the local Cursor trailer hook.** `scripts/ci/strip-cursor-coauthor.ts`, its test, and the `commit-msg` hook entry are deleted; with no remote trailer policy, a local stripper has nothing to serve.
- **Reduce `scripts/ci/commit-policy.ts` to its one remaining rule**: a source pull request that declares `Release-As` in its body must carry the same footer in a commit, since release-please consumes the footer from the merged commit. The `--mode` flag disappears with the modes it distinguished, and the check fails closed only when a `Release-As` declaration cannot be verified rather than on every metadata-free invocation.
- Update `docs/github-collaboration.md` and `docs/runbooks/releasing-quantex.md`, which documented re-authoring release branches to satisfy the removed author gate.

Attribution on `main` is instead addressed where the trailers are actually produced, by repository merge settings rather than by a pre-merge branch check.

## Capabilities

- **New Capabilities**: none.
- **Modified Capabilities**:
  - `release-workflow` — the protected-branch co-author trailer requirement is removed; `Release-As` commit-footer consistency remains.
  - `code-quality-tooling` — the local `commit-msg` Cursor trailer requirement is removed; `pre-push` returns to the repository-wide workflow gates.

## Impact

- `scripts/ci/commit-policy.ts`, `scripts/ci/strip-cursor-coauthor.ts` (deleted)
- `package.json` (`simple-git-hooks`), `.github/workflows/ci.yml`
- `test/commit-policy.test.ts`, `test/pr-governance.test.ts`, `test/strip-cursor-coauthor.test.ts` (deleted)
- `openspec/specs/release-workflow/spec.md`, `openspec/specs/code-quality-tooling/spec.md`
- `docs/github-collaboration.md`, `docs/runbooks/releasing-quantex.md`
- `openspec/changes/align-governance-gates/specs/code-quality-tooling/spec.md` (deleted): that change is merged but not yet archived, and its pre-push commit-policy requirement is superseded here before it was ever synced into `openspec/specs/`. Its PR-template requirement is unaffected and still archives normally.

No CLI behavior, structured output, agent catalog, config, state, or release-artifact surface changes.

## Intake classification

Durable-process and governance-contract change removing merge-gating requirements from two specs; OpenSpec required.
