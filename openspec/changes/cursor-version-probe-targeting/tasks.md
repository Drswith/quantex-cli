## 1. Internal Cursor probe targeting

- [x] 1.1 Add an internal lookup-name helper that tries `cursor-agent` before Cursor's `binaryName` without changing public types, catalog JSON, or catalog schema
- [x] 1.2 Keep Cursor identity frozen: `name` `cursor`, `binaryName` `agent`, lookup aliases `["agent"]`
- [x] 1.3 Do not project a preferred-binaries field through Core catalog generation

## 2. Resolve and probe the preferred executable

- [x] 2.1 Resolve each name with PATH then known install directories, first hit wins
- [x] 2.2 Use that order in Core production observation (list/inspect)
- [x] 2.3 Apply the same order in shared executable resolution and leftover observation/inspect/update probe call sites
- [x] 2.4 Keep substituting the resolved absolute path into probes whose first argument is `binaryName`

## 3. Tests

- [x] 3.1 Lock Cursor identity: `binaryName` is `agent`, aliases are `["agent"]` and do not include `cursor`, probe command stays `["agent", "--version"]`, and the catalog entry has no preferred-binaries field
- [x] 3.2 Assert list/inspect version comes from `cursor-agent` when PATH has a different `agent`
- [x] 3.3 Assert fallback to `agent` when `cursor-agent` is absent
- [x] 3.4 Do not update v1 command goldens unless `binaryName` in JSON actually changed (it must not)
- [x] 3.5 Keep the v1 root declaration type set and exported symbol set unchanged; refresh the bytes/sha256 pin only if size/hash drifted without type or export expansion

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 4.2 Run `bun run test`
- [x] 4.3 Run `bun run openspec:validate`
- [x] 4.4 Commit, push, and open a draft PR linking #715
