## 1. Specification

- [x] 1.1 Create OpenSpec proposal, design, and spec deltas for unmanaged uninstall feedback and display-name resolution.

## 2. Implementation

- [x] 2.1 Add failing tests for unmanaged uninstall output and display-name lookup.
- [x] 2.2 Implement unmanaged uninstall preflight with `UNINSTALL_UNMANAGED`.
- [x] 2.3 Implement display-name lookup for supported agents.
- [x] 2.4 Keep managed uninstall failure behavior on `UNINSTALL_FAILED`.

## 3. Validation

- [x] 3.1 Run focused tests for uninstall and registry lookup.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.
