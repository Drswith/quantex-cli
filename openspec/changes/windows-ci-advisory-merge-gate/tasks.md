# Tasks

## 1. Workflow gate change

- [x] 1.1 Add `continue-on-error: true` to the `test (windows-latest)` job in `.github/workflows/ci.yml`
- [x] 1.2 Document in workflow comments that Windows still runs and remains visible, but a failure must not fail `ci.yml` or block merge

## 2. Docs and contract tests

- [x] 2.1 Update `docs/github-collaboration.md` required-check list and advisory wording for Windows
- [x] 2.2 Update `docs/runbooks/releasing-quantex.md` CI coverage split so Windows is not listed as a required merge gate
- [x] 2.3 Amend `docs/adr/0009-workflow-v2.md` with the Windows non-blocking gate policy
- [x] 2.4 Update `test/workflow-classification.test.ts` to assert Windows remains present, uses `continue-on-error`, and is not treated as a required merge-gate context

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 3.2 Run `bun run test` for workflow classification (and full suite if needed)
- [x] 3.3 Run `bun run openspec:validate` and `bun run memory:check`
- [ ] 3.4 Commit, push, and open a PR whose description states Windows still runs but is not a merge gate
