## 1. Observation and update planning

- [ ] 1.1 Skip receipt-path source drift for non-script/non-binary recorded targets when the bound provider confirms present
- [ ] 1.2 Keep script/binary same-version and unknown-version receipt path conflicts, and keep provider-reported live path conflicts
- [ ] 1.3 Skip catalog provider probes on the update observation path when PATH, state, and receipt are all absent
- [ ] 1.4 Bound PATH version probes on update observation and treat nested probe timeout as unknown version

## 2. CLI progress

- [ ] 2.1 Emit a human-only initial progress line at the start of `update --all` without changing JSON/ndjson contracts

## 3. Tests

- [ ] 3.1 Add observation coverage for Codex-style bun package + relocated PATH binary
- [ ] 3.2 Add update planning coverage that the recorded package source is not blocked in that case
- [ ] 3.3 Add coverage that catalog-only absent update planning does not probe providers
- [ ] 3.4 Add coverage that a timed-out PATH version probe does not fail the observation

## 4. Validation and delivery

- [ ] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`
- [ ] 4.2 Run `bun run openspec:validate` and `bun run memory:check`
- [ ] 4.3 Commit, push, and open a draft PR that links #742
