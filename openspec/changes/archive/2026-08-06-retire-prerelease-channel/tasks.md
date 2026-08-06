# Tasks

## 1. Remove the prerelease channel from the contract

- [x] Write the `release-workflow` delta removing the prerelease requirement, with the reason and the evidence that disproved it
- [x] Retain the version-to-dist-tag mapping as an explicit fail-safe requirement so it is not later deleted as unreachable code
- [x] Leave `openspec/specs/` untouched; the delta applies during archive closure, so the removal is not applied twice

## 2. Docs

- [x] Drop the `Prereleases` section from `docs/releases.md`
- [x] Confirm no other doc still describes cutting a preview build

## 3. Confirm no code change is needed

- [x] `scripts/release/release-seal-contract.ts` keeps deriving the dist-tag from the version shape; that is the retained fail-safe
- [x] `scripts/ci/release-pr-policy.ts` keeps accepting a prerelease title shape, which stays harmless with nothing producing one

## 4. Validation and delivery

- [x] `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] `bun run test`
- [x] `bun run openspec:validate`, `bun run memory:check`
- [x] Commit, push, PR with a `pr:body:check`-validated body (#598, merged)

## 5. Maintainer action, outside this change

- [x] `npm dist-tag rm quantex-cli beta` — done by the maintainer; `dist-tags` is now `{ latest: 1.8.7 }` and `@beta` resolves to nothing
