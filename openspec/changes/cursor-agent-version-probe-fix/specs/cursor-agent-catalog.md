# Spec: Cursor Agent Catalog Update

## Agent Definition Contract

**File:** `src/agents/catalog/cursor.json`

The Cursor agent definition MUST:

1. **Binary Resolution**
   - `binaryName: "cursor-agent"` — The canonical executable name
   - `lookupAliases: ["agent", "cursor"]` — Support both legacy `agent` and natural `cursor` shortcuts
   - All command references use the canonical binary name

2. **Version Probing**
   - `versionProbe.command: ["cursor-agent", "--version"]`
   - Must resolve to the actual Cursor CLI executable, not any other agent-named binary
   - Probe result must accurately reflect Cursor's installed version

3. **Self-Update**
   - `selfUpdate.command: ["cursor-agent", "update"]`
   - Consistent with binary name change

4. **Display & Discovery**
   - `displayName: "Cursor CLI"` — unchanged
   - `name: "cursor"` — unchanged (identity for state/config)
   - `homepage: "https://cursor.com/docs/cli"` — unchanged

## Validation Rules

- **Lint:** No references to bare `"agent"` in Cursor's definition; all command arrays use `"cursor-agent"`
- **Schema:** Cursor entry in generated catalog must have `binaryName === "cursor-agent"`
- **Backward compat:** Both `qtx agent` (legacy) and `qtx cursor` (new) must resolve to the Cursor agent
- **Version accuracy:** `qtx inspect cursor` output field `installedVersion` must match `cursor-agent --version` output
