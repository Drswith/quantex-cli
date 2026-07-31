## 1. Resolver asset integrity

- [x] 1.1 Add GitHub Release asset integrity classification and required asset-name checks to `scripts/release-target-resolution.ts`
- [x] 1.2 Inspect remote release assets by tag in `resolveReleaseTargetFromEnvironment` and pass them into `selectReleaseCandidate`
- [x] 1.3 Select `publish` for the latest release commit when npm is published but assets are incomplete; fail closed when asset inspection is indeterminate

## 2. Regression coverage

- [x] 2.1 Add tests for asset-incomplete publish recovery and asset-indeterminate fail-closed behavior
- [x] 2.2 Keep existing npm-missing / older-release-no-backfill coverage green

## 3. Validation

- [x] 3.1 Run lint, format:check, typecheck, and the release-target resolution tests
- [x] 3.2 Run `bun run openspec:validate`
