# Session: 2026-08-05 Project structure and CI governance audit

## Context

Maintainer reported six perceived structural problems: too many `scripts/`; markdown chaos across spec/skill/`AGENTS.md`; conflicting gates; chaotic GitHub Actions; historical-compatibility bloat; and a beta channel older than stable. A follow-up pass then asked why PRs were restricted to a single commit, and whether the author-related gates could be removed.

Two audits ran: a six-dimension repository audit, and a failure audit over ~130 CI runs since 2026-07-16.

## Decisions

- **Five of the six original complaints were already resolved or were misreadings of intentional design.** The merged umbrella change `redesign-project-workflow` had addressed script consolidation, gate honesty, docs single-homing, and OpenSpec consolidation; the three non-canonical runtime `SKILL.md` files are byte-identical bootstrap stubs guarded by `memory:check`; the legacy engine is the sole implementation of dry-run and update/uninstall/run and cannot be removed in 1.x.
- **`scripts/` illegibility was real, but it was not about count.** A flat directory mixed 17 entrypoints, 5 imported helpers, and 4 test-spawned harnesses with no naming signal. Fixed by grouping into `build/`, `ci/`, `release/`, `smoke/`, `lib/` with file and npm script names unchanged (#586). The breakages a textual path search misses are `import.meta`-based repo-root computations and segment-style `join(ROOT, 'scripts', …)` lookups.
- **Governance gates were the largest source of CI failures** — about 53 of ~130 runs, ahead of Windows tests (30) and the release pipeline (13).
- **The shipped PR template did not pass the policy that guards it.** `release-workflow` requires bodies written from the template, GitHub pre-populates it into every PR, and its empty `Linked Artifacts` section was rejected. Fixed and locked with tests that run the real validator against the template and both release-please headers (#587).
- **The author-related gates were removed** (#588). Three linked rules — no `Co-authored-by:` trailer, no bot/agent commit author, no more than one commit per non-release PR — all served one goal, and measurement did not support them: enforced since 2026-05-04, `main` still accepted at least nine commits carrying a real trailer, crediting the maintainer's own GitHub noreply identity and the repository's release bot. GitHub adds those at merge time, where a check reading branch commits cannot see them.
- **The single-commit rule had no independent justification.** It was added two days after the trailer rule purely to stop squash from synthesizing trailers, and said so in its own failure message.
- **Rebase merge, not squash, is what put a bot author on `main`.** `#497` landed authored by `cursor[bot]` with the maintainer demoted to co-author, because rebase preserves the original author. The linear-history preference in `release-workflow` is therefore the path that produced the attribution the gates were written to prevent.
- **Repository settings**: merge commits disabled (already required by `release-workflow`), and `delete_branch_on_merge` enabled. Squash message left at `COMMIT_MESSAGES`: GitHub only accepts `PR_BODY` with `PR_TITLE`, and moving the squash body off branch commit messages changes what release-please reads from the merged commit, including the `BEGIN_COMMIT_OVERRIDE` block.
- **The release seal contract's squash-suffix fix was untested.** It cost v1.8.3 through v1.8.5 to find, and every `commitTitle` fixture used a clean title, so removing the normalization would not have failed the suite. Pinned in #589.

## Open Questions

- Whether branch protection lists the always-on `test (ubuntu-latest)` rather than the conditional Windows and macOS contexts, since the skip semantics rely on a skipped required check counting as passing. Not verifiable from the repository.
- Whether `release-workflow` should keep preferring rebase merge, given that squash produces better attribution and cleaner changelog entries, and that merge commits are now disabled.

## Follow-up

- **Resolved, but not as decided here**: the beta branch was retired, and the prerelease-from-main model recorded above was then disproved in practice — `Release-As` with a prerelease suffix produces a stable version, because release-please emits prereleases only from a config declaring them. The channel was dropped rather than rebuilt: the 1.x line had produced exactly one prerelease in 102 published versions. The maintainer subsequently removed the npm `beta` dist-tag, so no beta dist-tag is currently maintained.
- **Open**: `ci.yml` and `sandbox-tests.yml` declare no concurrency group, so a burst of PR edits leaves overlapping full-matrix runs.
- **Open**: `sandbox-tests` is advisory and has never failed in recent runs; moving it off per-PR triggering would cut cost without losing signal.
- **Open**: `AGENTS.md` restates the validation-routing matrix and OpenSpec intake signals that the runtime skill already carries in full, with no parity guard.
- **Deferred to a later major**: switch CLI `--dry-run` onto Core preview and retire the `QUANTEX_INSTALLATION_ENGINE=legacy` escape.
- **Resolved during the audit**: the Windows `test/ci-context.test.ts` flake (fixed by `04ab970`), and the release seal contract title matching (fixed by `d315ade` and `2c4ef7c`, pinned by #589).
- **Repository hygiene**: worktrees reduced from 13 to 4, local branches from 57 to 13, remote branches from 100 to 18; `delete_branch_on_merge` now prevents the pile-up from recurring.
