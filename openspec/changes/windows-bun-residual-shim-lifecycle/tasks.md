# Tasks

## 1. Provider missing versus inconclusive presence

- [x] 1.1 Map spawn `ENOENT`/`ENOTDIR` in Core package observation probes to `presence: unavailable` and surface `kind: 'unavailable'` from `createPackageAdapter.observe`
- [x] 1.2 Skip `unavailable` catalog outcomes when aggregating unresolved exact-provider evidence in `observeAgentLifecycle`
- [x] 1.3 When bun is conclusively absent, no exact provider is live or presence-inconclusive, and `PATH` resolves under Bun's global bin, report observation absent while keeping `pathExecutable` present
- [x] 1.4 Keep PATH-present plus a genuinely indeterminate available-provider probe fail-closed

## 2. Windows Bun shim uninstall cleanup

- [x] 2.1 Capture and remove an unchanged `{binary}.exe` plus `{binary}.bunx` pair in `bun pm bin -g` after conclusive bun package absence
- [x] 2.2 Preserve unproven, changed, sidecar-less, or out-of-bin regular files
- [x] 2.3 Extend the conflicting-source leftover-PATH uninstall message to name the `.exe`/`.bunx` pair

## 3. Regression tests

- [x] 3.1 Cover npm spawn `ENOENT` in the Core observation registry as `unavailable`
- [x] 3.2 Cover `executable.present` + preferred bun absent + npm unavailable (installable) versus npm indeterminate (fail-closed)
- [x] 3.3 Cover leftover `/.bun/bin/` PATH plus bun absent + npm absent/unavailable into `decideCoreInstallation` → `install`
- [x] 3.4 Cover Windows shim pair cleanup and preservation in bun uninstall tests

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `bun run openspec:validate`, and `bun run memory:check`
- [ ] 4.2 Commit, push, and open a draft PR that links #733, names this OpenSpec change, and uses user-facing bugfix release framing without cutting a release
