# Tasks: Cursor Agent Version Probe Fix

## Implementation Tasks

### 1. Update Cursor Agent Catalog Definition
**File:** `src/agents/catalog/cursor.json`

- [ ] Change `binaryName` from `"agent"` to `"cursor-agent"`
- [ ] Update `lookupAliases` from `["agent"]` to `["agent", "cursor"]`
- [ ] Change `versionProbe.command` from `["agent", "--version"]` to `["cursor-agent", "--version"]`
- [ ] Change `selfUpdate.command` from `["agent", "update"]` to `["cursor-agent", "update"]`
- [ ] Verify all other properties remain unchanged

### 2. Regenerate Agent Catalog
**File:** `src/core/generated/agent-catalog.ts`

- [ ] Run `bun run build` to regenerate the catalog
- [ ] Verify Cursor entry in generated file uses `"cursor-agent"` consistently
- [ ] Confirm no formatting issues in generated code

### 3. Validation
- [ ] Run `bun run lint` — must pass
- [ ] Run `bun run format:check` — must pass
- [ ] Run `bun run typecheck` — must pass
- [ ] Run `bun run test` — all tests must pass

### 4. Manual Testing
- [ ] `qtx inspect cursor` — shows correct installed version
- [ ] `qtx ls` — Cursor row shows correct version matching `cursor-agent --version`
- [ ] `qtx agent` — still works (backward compat via alias)
- [ ] `qtx cursor` — now works (new alias)

### 5. Archive Closure
- [ ] Commit changes with message: "fix(agents): use cursor-agent binary for version probing (P2)"
- [ ] Push to branch
- [ ] Create PR with template body
- [ ] Wait for CI to pass
- [ ] Merge PR
- [ ] Run `bun run openspec:archive-closure -- cursor-agent-version-probe-fix`
