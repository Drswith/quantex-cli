## 1. Channel forwarding

- [x] 1.1 Add a narrow helper that accepts only `stable` | `beta` as explicit upgrade channel options
- [x] 1.2 Wire `quantex upgrade --channel` through that helper so `stable` is forwarded, not dropped

## 2. Regression coverage

- [x] 2.1 Add a unit test that `stable` and `beta` remain explicit requests and invalid values stay unset
- [x] 2.2 Add coverage that `upgradeCommand({ channel: 'stable' })` passes `stable` into planning
- [x] 2.3 Add/extend `getSelfUpdateChannel('stable', 'beta', ...)` coverage proving requested stable wins

## 3. Validation

- [ ] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [ ] 3.2 Run `bun run openspec:validate`
