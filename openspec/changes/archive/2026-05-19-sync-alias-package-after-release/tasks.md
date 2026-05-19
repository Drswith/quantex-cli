## 1. Release Workflow

- [x] 1.1 Add a post-npm-publish `repository_dispatch` step in `.github/workflows/release.yml`.
- [x] 1.2 Derive the alias dispatch payload version without a leading `v` and map prerelease versions to `npm_tag=next`.
- [x] 1.3 Skip the alias synchronization dispatch without failing the release when `QUANTEX_SYNC_TOKEN` is not configured.

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 2.2 Run `bun run openspec:validate`.
- [x] 2.3 Confirm git and OpenSpec closure state for handoff.
