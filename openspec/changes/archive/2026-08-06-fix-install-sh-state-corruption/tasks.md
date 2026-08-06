## 1. Installer safety

- [x] 1.1 Rewrite `install.sh` state recording to fail closed on unreadable/unsafe existing `state.json`
- [x] 1.2 Make successful `install.sh` state updates use a same-directory temp file and atomic replace
- [x] 1.3 Preserve existing installed-agent and lifecycle evidence when recording `self.installSource`

## 2. Regression coverage

- [x] 2.1 Add `test/install-scripts.test.ts` assertions for fail-closed parse handling and atomic replace
- [x] 2.2 Add a focused behavioral check that corrupt state is left untouched by the Python recorder path

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate` and `bun run memory:check`
