## 1. OpenSpec and documentation

- [x] 1.1 Add proposal, design, tasks, and `agent-catalog` spec delta artifacts for `omp` support.
- [x] 1.2 Update static supported-agent documentation snapshots to include `omp`.

## 2. Catalog implementation and test coverage

- [x] 2.1 Add `src/agents/catalog/omp.json` with verified lifecycle metadata and regenerate catalog manifests.
- [x] 2.2 Re-export `omp` from agent runtime/library entry points.
- [x] 2.3 Add or update tests that validate `omp` lookup metadata, install methods, and exports.

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`.
- [x] 3.2 Run `bun run format:check`.
- [x] 3.3 Run `bun run typecheck`.
- [x] 3.4 Run `bun run test`.
- [x] 3.5 Run `bun run openspec:validate`.
- [x] 3.6 Commit, push branch, and open a PR that links issue #281.
