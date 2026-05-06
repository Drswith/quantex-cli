## 1. OpenSpec

- [x] 1.1 Add proposal, design, and spec delta for trusted checkout of release PR policy.

## 2. Implementation

- [x] 2.1 Point `release-pr-automerge.yml` checkout `ref` at `github.event.pull_request.base.sha`.

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.

## 4. Delivery

- [x] 4.1 Commit, push branch `cursor/critical-bug-inspection-3c4b`, and open or update PR.
