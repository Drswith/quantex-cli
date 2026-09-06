## 1. Catalog targeting metadata

- [x] 1.1 Add optional `versionProbe.preferredBinaries` to `AgentVersionProbe`, catalog schema, and Core catalog projection
- [x] 1.2 Set Cursor `preferredBinaries` to `["cursor-agent"]` without changing `name`, `binaryName`, or `lookupAliases`
- [x] 1.3 Regenerate agent catalog manifests and Core catalog

## 2. Resolve and probe the preferred executable

- [x] 2.1 Add a lookup-name helper that tries preferred binaries before `binaryName`
- [x] 2.2 Resolve each name with PATH then known install directories, first hit wins
- [x] 2.3 Use that order in Core production observation (list/inspect)
- [x] 2.4 Apply the same order in shared executable resolution and leftover observation/inspect/update probe call sites
- [x] 2.5 Keep substituting the resolved absolute path into probes whose first argument is `binaryName`

## 3. Tests

- [x] 3.1 Lock Cursor identity: `binaryName` is `agent`, aliases are `["agent"]` and do not include `cursor`, probe command stays `["agent", "--version"]`
- [x] 3.2 Assert list/inspect version comes from `cursor-agent` when PATH has a different `agent`
- [x] 3.3 Assert fallback to `agent` when `cursor-agent` is absent
- [x] 3.4 Do not update v1 command goldens unless `binaryName` in JSON actually changed (it must not)

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 4.2 Run `bun run test`
- [x] 4.3 Run `bun run openspec:validate`
- [x] 4.4 Commit, push, and open a draft PR linking #715
