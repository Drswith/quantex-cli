# Design: Cursor Agent Version Probe Fix

## Changes

### 1. Update Cursor Agent Catalog (src/agents/catalog/cursor.json)

**Current state:**
```json
{
  "name": "cursor",
  "lookupAliases": ["agent"],
  "displayName": "Cursor CLI",
  "binaryName": "agent",
  "selfUpdate": {
    "command": ["agent", "update"]
  },
  "versionProbe": {
    "command": ["agent", "--version"]
  },
  ...
}
```

**New state:**
```json
{
  "name": "cursor",
  "lookupAliases": ["agent", "cursor"],
  "displayName": "Cursor CLI",
  "binaryName": "cursor-agent",
  "selfUpdate": {
    "command": ["cursor-agent", "update"]
  },
  "versionProbe": {
    "command": ["cursor-agent", "--version"]
  },
  ...
}
```

**Rationale:**
- `binaryName: "cursor-agent"` matches Cursor's actual installation structure
- `versionProbe.command: ["cursor-agent", "--version"]` directly targets the correct binary
- `lookupAliases: ["agent", "cursor"]` preserves backward compatibility for both old and new invocation styles
- `selfUpdate.command` updated for consistency

## Affected Catalog Regeneration

- `src/core/generated/agent-catalog.ts` will be regenerated from the catalog definition
- No changes needed to version probe parsing logic in `src/core/production-observation.ts`
- The fix is purely a data change in the agent definition

## Testing Coverage

Version probe accuracy will be validated by:
1. Manual: `qtx inspect cursor` reports correct version matching `cursor-agent --version`
2. List command: `qtx ls` shows Cursor with correct installed version
3. Schema validation: `bun run lint` and `bun run typecheck` pass

## Backward Compatibility

- `qtx agent` still works (via `lookupAliases`)
- `qtx cursor` now also works (via new alias)
- CLI output remains stable (no user-facing changes)
- Installed state file continues to reference agent by `name: "cursor"`
