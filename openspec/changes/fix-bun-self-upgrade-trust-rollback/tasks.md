## 1. Implementation

- [x] 1.1 Probe Bun global package presence before `bun add -g` in `runGlobalBunCommandWithTrust`
- [x] 1.2 On trust failure after `add`, remove only packages whose pre-add presence was `absent`
- [x] 1.3 Keep fail-closed `false` return when trust/probe fails for install and update paths

## 2. Tests

- [x] 2.1 Keep regression coverage that absent packages are removed after trust failure on install
- [x] 2.2 Add coverage that already-present packages are not removed after trust failure on install/re-add
- [x] 2.3 Add coverage that Bun self-upgrade trust/probe failure does not invoke `bun remove -g`

## 3. Validation

- [ ] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [ ] 3.2 Run `bun run openspec:validate`
