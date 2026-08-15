## 1. OpenSpec and rollback preparation

- [x] 1.1 Record the removal proposal, design, delta specs, and delivery checklist in `remove-macos-desktop-client`
- [x] 1.2 Confirm the rollback targets are merged PRs #557, #647, #649, and #651 and that unrelated release commits remain out of scope

## 2. Product and source rollback

- [x] 2.1 Revert merged PR #651 and remove the archived appearance-mode OpenSpec artifacts
- [x] 2.2 Revert merged PR #649 and remove the Desktop appearance-mode implementation
- [x] 2.3 Revert merged PR #647 and remove the archived macOS Desktop OpenSpec artifacts
- [x] 2.4 Revert merged PR #557 and remove the Desktop app, sidecar pipeline, Desktop workspace, and Desktop-only CLI extensions
- [x] 2.5 Verify ordinary CLI lifecycle commands and non-Desktop update contracts remain present

## 3. Validation and delivery

- [x] 3.1 Confirm no active source, package, workflow, test, or release entry still exposes the removed Desktop product
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.3 Run `bun run openspec:validate` and `bun run memory:check`
- [x] 3.4 Commit the explicit Revert changes and OpenSpec removal change on the dedicated branch
- [x] 3.5 Push the branch, validate the PR body, and open the rollback PR against protected `main`
- [x] 3.6 Review remote CI and report PR, merge, release, and archive-closure state separately
