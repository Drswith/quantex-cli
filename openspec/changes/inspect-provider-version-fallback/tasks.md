## 1. Projector

- [x] 1.1 Change `projectObservationToV1Inspection` to source `installedVersion` from merged `result.executable` when `pathExecutable` is present
- [x] 1.2 Keep `inPath`, `binaryPath`, and `resolvedBinaryPath` on PATH presence so a provider-only version does not mark an agent installed

## 2. Regression coverage

- [x] 2.1 Add a projector test: PATH present, version probe empty, provider version present → `installedVersion` is the provider version
- [x] 2.2 Add list, inspect, and doctor command tests for the same PATH-present + failed probe + provider version case

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 3.2 Run `bun run test`
- [x] 3.3 Run `bun run openspec:validate` and `bun run memory:check`
- [x] 3.4 Commit, push, and open a draft PR that links #734
