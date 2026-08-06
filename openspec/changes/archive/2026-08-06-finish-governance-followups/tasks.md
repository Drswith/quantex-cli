# Tasks

## 1. Retire the beta channel (P0)

- [x] `scripts/release/release-seal-contract.ts`: resolve `targetBranch` to `main` for every release; keep `channel` and `npmTag` deriving from the version shape
- [x] `scripts/release/tag-release.ts`: accept only `main` as the release branch
- [x] `scripts/ci/release-pr-policy.ts`: restrict release base branches to `main`; accept both stable and prerelease title shapes there
- [x] `scripts/ci/path-taxonomy.ts`: drop `release-please-config.beta.json` from the release manifest paths
- [x] `.github/workflows/release-please.yml`: trigger on `main` only; delete the config-select step
- [x] `.github/workflows/release.yml`: stop deriving a beta target branch
- [x] `.github/workflows/{ci,sandbox-tests}.yml`: drop `beta` from branch triggers
- [x] Delete `release-please-config.beta.json`
- [x] Update tests for release identity, tag targeting, release PR policy, and path taxonomy

## 2. CI concurrency (P1)

- [x] Add a cancelling concurrency group to `ci.yml` keyed on PR number or ref
- [x] Add a cancelling concurrency group to `sandbox-tests.yml`
- [x] Assert both groups in tests, and assert release workflows keep `cancel-in-progress: false`

## 3. Sandbox tests off per-PR triggering (P2)

- [x] `.github/workflows/sandbox-tests.yml`: keep schedule and dispatch, drop pull_request and push triggers
- [x] Removed the classify job outright: it only ever gated the per-PR run, and scheduled runs always saw a null diff
- [x] Update the runbook and tests that assert the per-PR trigger

## 4. AGENTS.md routing parity (P2)

- [x] Compress the `AGENTS.md` validation block to triggers pointing at the runtime skill
- [x] Intake-signal block: **no change needed**. It already opens with a pointer to the runtime skill and carries only trigger keywords, so the audit finding was overstated for this block; the validation matrix was the only genuine restatement
- [x] Extend `scripts/ci/check-project-memory.ts` to verify the runtime skill carries the deferred detail
- [x] Guard is exercised by `bun run memory:check` in pre-push and the CI lint job

## 5. Docs

- [x] `docs/releases.md`: describe the single channel and how a prerelease is cut from `main`
- [x] `docs/runbooks/releasing-quantex.md`: remove the beta release path
- [x] `docs/github-collaboration.md`: branch protection now covers `main` only

## 6. Validation and delivery

- [x] `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] `bun run test`
- [x] `bun run openspec:validate`, `bun run memory:check`
- [x] `bun run release:dry-run`
- [x] Commit, push, PR with a `pr:body:check`-validated body (#591, merged; concurrency defect corrected by #593)
