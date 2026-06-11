## 1. Implementation

- [x] 1.1 Detect release commits whose GitHub release/tag exists but npm package version is missing
- [x] 1.2 Keep publish-mode validation/build/npm publish/upload steps active for resolver-selected release commits
- [x] 1.3 Add release-target resolver regression coverage
- [x] 1.4 Update release-workflow spec

## 2. Validation

- [x] 2.1 Run `bun run lint`
- [x] 2.2 Run `bun run format:check`
- [x] 2.3 Run `bun run typecheck`
- [x] 2.4 Run `bun run test`
- [x] 2.5 Run `bun run openspec:validate`
- [x] 2.6 Run `bun run memory:check`

## 3. Delivery

- [ ] 3.1 Create a PR with validated body
- [ ] 3.2 Merge only after PR Governance, CI, Sandbox Tests, and Cursor PR Governance are green
- [ ] 3.3 Trigger or wait for Release workflow recovery
- [ ] 3.4 Verify `npm view quantex-cli version dist-tags --json` reports `0.23.5` as `latest`
