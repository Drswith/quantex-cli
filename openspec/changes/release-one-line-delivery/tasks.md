## 1. OpenSpec and contracts

- [x] 1.1 Complete proposal, design, and `release-workflow` delta specs for seal=tag+Release-success and pre-npm candidate installer smoke
- [x] 1.2 Align tasks with the implementation checklist below

## 2. Seal before prepare (current release fully published)

- [x] 2.1 Extend `resolveBranchSealState` so a branch is sealed only when the tip manifest tag exists and `releaseSucceeded` is true
- [x] 2.2 Add `hasSuccessfulReleaseWorkflowRun` (or equivalent) in `release-seal-contract.ts` that fail-closes unless `release.yml` has a successful run for that tag
- [x] 2.3 Teach `publishBranchSealState` to query Release success when the tag exists before publishing the `sealed` output
- [x] 2.4 Trigger `release-please.yml` on successful `Release` completion (`workflow_run`) so preparation can resume without an unrelated later push
- [x] 2.5 Update tag-release / workflow classification tests so preparation cannot be asserted as sealed on tag-only evidence

## 3. Candidate installer smoke before npm publish

- [x] 3.1 Add optional `QUANTEX_DOWNLOAD_BASE` support to `install.sh` and `install.ps1` (default GitHub Release URLs unchanged)
- [x] 3.2 Reorder `release.yml` so `verify-installers` needs only `build-candidate`, downloads the release-candidate artifact, serves candidate assets locally, and runs installers with `QUANTEX_DOWNLOAD_BASE`
- [x] 3.3 Make `publish` need `[build-candidate, verify-installers]` so npm publish cannot run before smoke
- [x] 3.4 Update release-target / installer workflow tests to lock the new job graph and download-base wiring

## 4. Docs

- [x] 4.1 Update `docs/runbooks/releasing-quantex.md` for seal=tag+Release-success, workflow_run resume, and pre-npm candidate smoke
- [x] 4.2 Update `docs/releases.md` overview to match
- [x] 4.3 Add a short amendment note to `docs/adr/0009-workflow-v2.md`

## 5. Validation and delivery

- [x] 5.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 5.2 Run focused release/workflow/installer tests and `bun run test` as needed
- [x] 5.3 Run `bun run openspec:validate` and `bun run memory:check`
- [x] 5.4 Run `bun run release:dry-run` because release workflows/scripts change
- [x] 5.5 Commit, push, and open a PR whose description states the new order in one paragraph and that tests/workflow structure make npm-before-smoke and prepare-before-seal impossible
