## 1. Contract

- [x] 1.1 Document the optional Docker and Modal isolation layer in the OpenSpec proposal, design, and code-quality-tooling delta spec.
- [x] 1.2 Record contributor guidance for when the isolation layer should complement local `bun run test`.

## 2. Implementation

- [x] 2.1 Add repository-native `bun run test:container` and `bun run test:sandbox` harnesses that run real lifecycle smoke checks inside isolated Bun environments.
- [x] 2.2 Add implementation tests for the isolation invocation builders and update maintainer-facing docs/runbooks.
- [x] 2.3 Add a dedicated GitHub Actions workflow for Modal-backed sandbox tests without expanding the merge-gating `ci.yml` workflow.

## 3. Validation

- [x] 3.1 Run `bun run lint`.
- [x] 3.2 Run `bun run format:check`.
- [x] 3.3 Run `bun run typecheck`.
- [x] 3.4 Run `bun run test`.
- [x] 3.5 Run `bun run openspec:validate`.
