# ADR 0009: Workflow v2 — Real Gates, Consolidated Scripts, Single-Source Process Rules

## Status

Accepted

## Context

ADR 0008 consolidated CI and moved the release train to release-please, but a full-repo audit six months in showed the workflow had outgrown the design again:

- Half of the last 120 commits on `main` were process overhead (release bumps, OpenSpec archive PRs, release-automation fixes), not product work.
- The release pipeline had been in a continuous fix-on-fix loop across three mechanism redesigns, exercised end-to-end only by cutting real releases.
- The "tag backstop" was itself a patch over a structural conflict: the repository re-authors and rebase-merges Release PRs, while release-please assumes it merges and tags its own PRs.
- Nominally required checks did not match reality: `test (windows-latest)` never ran on PRs, `sandbox-tests` silently passed on fork PRs, and the `governance` job was advisory while ADR 0008 implied a strict gate.
- The same process rules were restated in up to five homes; three agent-runtime bootstrap stubs had no sync mechanism and had already drifted.
- 35 `scripts/` files included seven near-duplicate clusters; `release.yml` carried untestable inline Node heredocs; `bunfig.toml` `ignoreScripts=true` silently disabled hook installation, so local hooks were stale.

## Decision

1. **Script consolidation.** Merge the seven duplicate clusters (package-manager lifecycle smokes, release artifact chain, commit policies, isolation runners, v1 downstream check, JS release-PR policy, catalog schema writer) so `scripts/` drops from 35 files to 28. Add three testable scripts: `ci-context.ts` (one changed-file/commit collector for all workflows), `release-candidate.ts` (the build-candidate chain runnable locally as `bun run release:dry-run`), and `verify-release-candidate.ts` (publish-side checks moved out of YAML).
2. **Honest gates.** Required merge checks are exactly the jobs that really run on every PR: `lint`, `governance`, `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)`. Windows tests now run on product-impacting PRs. `sandbox-tests` is explicitly advisory and never required. `classify` computes context once; every downstream job consumes its outputs.
3. **Deterministic release tagging.** release-please keeps `skip-github-release: true`; a designed `tag-release` job (renamed from the backstop) tags merged Release PRs with `git push` under the GitHub App token — the tag event is the primary `release.yml` trigger, and a workflow dispatch is only a polled fallback, so publication starts exactly once.
4. **Major version gate.** A stable Release PR proposing a new major is rejected unless a maintainer adds `Release-As: <version>` to the Release PR body, closing the accidental-major path.
5. **One rule, one home.** `skills/quantex-agent-runtime/SKILL.md` remains the sole full process text; `AGENTS.md` and `openspec/config.yaml` keep triggers and pointers only. Four OpenSpec release specs merge into `release-workflow`; `ci-platform-coverage` merges into `code-quality-tooling`; `core-installation-soak` is reframed as `installation-routing` without the expired time-box (21 specs to 17). Duplicate, drifted, and policy-violating docs are removed.
6. **Bootstrap stub single-sourcing.** The three agent-runtime bootstrap stubs (`.agents/`, `.codex/`, `.github/skills/`) are byte-identical copies of `skills/quantex-agent-runtime/bootstrap-stub.md`, enforced by `memory:check`. *(Amended 2026-08-07: `.claude/` joins the set as a fourth stub. It previously reached the central runtime by symlink, which left it outside parity enforcement and dependent on checkout-time symlink support; agent bootstrap entries are now required to be regular files, enforced by `memory:check` and by an index-mode assertion in the test suite. See the `project-memory` spec.)*
7. **Explicit hook installation.** `bun run setup` installs `simple-git-hooks`; `bun install` no longer pretends to install them. `pre-commit` runs `bunx lint-staged` only.

## Consequences

- Branch rulesets on `main` and `beta` must be updated once by a maintainer: require `lint`, `governance`, `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)`; remove `sandbox-tests` from required contexts. The `release-workflow` spec carries this contract.
- The first release after this lands exercises the new `tag-release` path live; `bun run release:dry-run` covers the candidate chain locally before then.
- ADR 0008 remains the record of the release-please migration; this ADR supersedes its ruleset alignment (point 5) and refines its archive/doc hierarchy decisions where they drifted.
- Scripts were renamed without keeping aliases (`commit-policy.ts`, `pm-lifecycle-smoke.ts`, `test-isolation.ts`, `release-artifacts.ts`, `tag-release.ts`, `release-pr-policy.ts`); git history preserves the old names.
