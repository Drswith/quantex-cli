## 1. Shared Classification Contract

- [x] 1.1 Add a repository-native path taxonomy/classification script for process-only vs product-impacting changes.
- [x] 1.2 Add focused tests or assertions for the shared classifier behavior.

## 2. Local Validation Left Shift

- [x] 2.1 Add a `pre-push` hook that runs `format:check`, `typecheck`, `openspec:validate`, and `memory:check`.
- [x] 2.2 Keep `pre-commit` scoped to staged formatting/lint fixes and document the split in repository-native workflow guidance if needed.

## 3. Workflow Integration

- [x] 3.1 Update merge-gating CI to consume the shared classifier and run a minimal Ubuntu build for process-only changes.
- [x] 3.2 Update PR governance to consume the shared classifier for process-only and product-impacting release-intent checks.

## 4. Validation And Closure

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run openspec:validate`, and `bun run memory:check`.
- [x] 4.2 Run `bun run test` if the classifier or workflow-support code gains behavior that is covered by automated tests.
- [x] 4.3 Report OpenSpec, validation, git, commit, push, PR, release, and archive-closure state for this implementation pass.
