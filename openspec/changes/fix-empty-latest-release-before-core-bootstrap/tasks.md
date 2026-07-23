## 1. Release workflow ordering

- [x] 1.1 Move Core npm bootstrap validation before the Release Please GitHub Release step for `core_required` publish runs
- [x] 1.2 Make the early gate self-contained (registry identity + `CORE_NPM_TRUSTED_PUBLISHING_READY`) without depending on post-build npm publication outputs
- [x] 1.3 Keep Core-before-CLI publish, npm closure verification, and artifact upload ordering unchanged after a successful early gate

## 2. Tests and docs

- [x] 2.1 Update workflow-structure tests so bootstrap precedes GitHub Release creation and still precedes publish commands
- [x] 2.2 Update `docs/releases.md` to state that incomplete Core bootstrap fails before public GitHub Release creation

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `bun run openspec:validate`, and `bun run memory:check`
- [ ] 3.2 Commit, push, prepare PR body from the template, run `pr:body:check`, and open the PR
- [ ] 3.3 Report remaining maintainer owner for live `v1.2.0` recovery
