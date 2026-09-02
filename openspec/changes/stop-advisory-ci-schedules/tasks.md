# Tasks

## 1. Workflow triggers

- [x] 1.1 Remove the `schedule` block from `.github/workflows/sandbox-tests.yml` and update the header comment so it no longer claims a standing schedule
- [x] 1.2 Remove the Saturday `schedule` block from `.github/workflows/agent-canary.yml` and update comments if they claim a standing schedule; keep `pull_request` and `workflow_dispatch`

## 2. Docs and contract tests

- [x] 2.1 Update `docs/runbooks/modal-sandbox-testing.md` sentences that claim a weekly/automatic canary schedule
- [x] 2.2 Update matching README / README.zh-CN sentences that claim schedule-driven full canaries
- [x] 2.3 Update `test/workflow-classification.test.ts` so it asserts no standing schedule while keeping dispatch (and PR canaries)

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 3.2 Run `bun run test` focused on workflow classification (and full suite if needed)
- [x] 3.3 Run `bun run openspec:validate` and `bun run memory:check`
- [ ] 3.4 Commit, push, and open a PR whose description states manual dispatch still works
