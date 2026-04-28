## 1. Scope merge-gating CI

- [x] 1.1 Add change classification to `.github/workflows/ci.yml` so process-only diffs can skip the cross-platform test matrix while preserving the existing required job contexts.
- [x] 1.2 Keep lint, format, project-memory, and OpenSpec validation on the merge-gating path for both product-impacting and process-only changes.

## 2. Gate release on green CI

- [x] 2.1 Rework `.github/workflows/release.yml` so the automated release path runs from successful `CI` workflow completion on `main` or `beta` instead of racing raw `push` events.
- [x] 2.2 Ensure release relevance detection still supports non-release merges, release-worthy merges, Release PR merges, and manual dispatch.

## 3. Sync durable workflow docs and validate

- [x] 3.1 Update `docs/github-collaboration.md` to document the scoped CI behavior and the release-after-green-CI rule.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run openspec:validate`.
