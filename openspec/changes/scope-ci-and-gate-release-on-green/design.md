## Context

`main` currently requires `lint`, `validate-body`, and the three `test (<os>)` contexts at the GitHub ruleset layer, but `ci.yml` always expands the full three-OS matrix regardless of whether a change only touches docs, OpenSpec, or release-process metadata. In the same workflow topology, `release.yml` listens directly to `push` on `main` and `beta`, so it can create Release PRs or publish a release in parallel with push-side CI rather than after CI has succeeded.

## Goals / Non-Goals

**Goals:**

- Reduce merge-gating CI cost for process-only changes without weakening required status check enforcement.
- Keep the existing required CI context names stable so repository rulesets do not need to be updated for every scoped CI run.
- Ensure release automation for protected branches only runs after a successful branch CI completion.
- Preserve manual `workflow_dispatch` as an explicit maintainer escape hatch.

**Non-Goals:**

- Redesign release-please versioning policy or PR governance rules.
- Remove Windows, macOS, or Ubuntu coverage for product-impacting changes.
- Introduce a custom workflow orchestration layer outside normal GitHub Actions primitives.

## Decisions

### 1. CI will classify changes before running expensive jobs

`ci.yml` will gain an initial classification job that computes whether the current diff is product-impacting or process-only. The classifier will reuse the same broad repository boundaries already used by PR governance:

- product-impacting: `src/`, `scripts/`, install surfaces, package metadata, lockfiles, or other code/runtime inputs
- process-only: `.github/`, `docs/`, `openspec/`, and release-process metadata

This lets the repository express one durable policy for “what can affect shipped behavior” rather than letting CI and governance drift independently.

Alternative considered:

- Top-level `paths-ignore`: rejected because required status checks would disappear entirely for skipped PRs.

### 2. Required test job names will stay stable even when jobs are skipped

The three `test (<os>)` contexts are already hard-coded in the active `main` ruleset. Instead of deleting or renaming them, the test matrix job will remain in place and will be skipped at the job level when the classifier marks a change as process-only. GitHub records skipped jobs as completed check contexts, so ruleset enforcement remains intact while avoiding runner startup and install cost for unnecessary platforms.

Alternative considered:

- Replace matrix jobs with a single aggregate check: rejected because it would require synchronized ruleset changes and make platform failures less visible.

### 3. Release automation will move from `push` to successful `workflow_run` completion

`release.yml` will trigger from successful `CI` completions on `main` and `beta`, plus manual dispatch. The workflow will checkout the exact `head_sha` from the completed CI run and derive release relevance from that commit message instead of from the `push` event payload. This makes protected-branch release decisions depend on a green CI result rather than racing it.

Alternative considered:

- Poll CI from inside the existing `push`-triggered release workflow: rejected because it introduces extra synchronization logic and still starts release work before the CI outcome is known.

### 4. Manual dispatch remains a deliberate bypass for operators

`workflow_dispatch` will continue to allow maintainers to run release automation directly. This keeps recovery and manual retry paths available if CI metadata or GitHub workflow events need intervention, but the default automated path will now require successful CI first.

## Risks / Trade-offs

- [Classification drift between CI and governance] → Keep the path taxonomy close to the existing PR governance logic and document the intent in specs/docs so future edits update both together.
- [Skipped jobs might hide an unexpected process/runtime coupling] → Limit skipping to clearly process-only paths and keep lint, project-memory, and OpenSpec validation always-on.
- [Release latency increases] → Release now waits for `main`/`beta` CI completion, but this is the intended trade-off for publication safety.
- [Manual dispatch can still bypass CI] → Treat manual dispatch as an operator-only recovery path and document that it is an explicit bypass, not the default release path.
