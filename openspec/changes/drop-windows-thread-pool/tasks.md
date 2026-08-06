# Tasks

## 1. Remove the override

- [x] Drop `--pool=threads` from the `test (windows-latest)` job in `.github/workflows/ci.yml`
- [x] Confirm all three platform jobs now invoke the same command

## 2. Contract

- [x] Restate the Windows coverage requirement so it no longer mandates a thread-pool invocation
- [x] Record why the override was removed, so the next reader does not restore it as a fix
- [x] Require a recorded reason and evidence before any platform-specific pool override returns
- [x] Leave `openspec/specs/` untouched; the delta applies during archive closure

## 3. Guard against silent reintroduction

- [x] Assert in `test/workflow-classification.test.ts` that no platform job passes a `--pool` override

## 4. Validation and delivery

- [x] `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] `bun run test`
- [x] `bun run openspec:validate`, `bun run memory:check`
- [ ] Commit, push, PR with a `pr:body:check`-validated body

## 5. Follow-up after merge

- [ ] Watch the Windows job for exit 5. If it recurs, the pool was not the whole cause and the investigation resumes from that observation
