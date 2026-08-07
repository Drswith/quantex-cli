# Tasks

## 1. Replace the `.claude` symlink with a stub copy

- [x] Delete the `.claude/skills/quantex-agent-runtime` symlink (git mode `120000`)
- [x] Create `.claude/skills/quantex-agent-runtime/SKILL.md` as a byte-identical copy of `skills/quantex-agent-runtime/bootstrap-stub.md`
- [x] Confirm `git ls-files -s` reports mode `100644` for the new entry and no symlink remains in the tree

## 2. Extend parity enforcement to the fourth entry

- [x] Add `.claude/skills/quantex-agent-runtime/SKILL.md` to `runtimeStubPaths` in `scripts/ci/check-project-memory.ts`
- [x] Add the same path to `stubPaths` in `test/project-memory.test.ts`
- [x] Verify the parity assertion fails when the new entry is mutated, then restore it

## 3. Specs and docs

- [x] Add the single-sourced-regular-file requirement to the `project-memory` delta spec
- [x] Update the single-sourcing note in `docs/adr/0009-workflow-v2.md`, which enumerates three stubs

## 4. Validation

- [x] `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] `bun run test`
- [x] `bun run openspec:validate`, `bun run memory:check`

## 5. Delivery closure

- [ ] Commit on `claude/skills-symlink-location-0588e2` and push
- [ ] Open the PR with a `pr:body:check`-validated body file
- [ ] Report validation, OpenSpec, git, commit, remote, PR, release, and archive-closure state
