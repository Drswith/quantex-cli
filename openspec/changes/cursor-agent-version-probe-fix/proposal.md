# Cursor Agent Version Probe Fix

## Problem

The Cursor agent catalog configuration uses `agent` as the binary name and probes the version via `agent --version`. This creates two issues:

1. **Binary name collision**: The generic name `agent` conflicts with the Quantex agent runtime, both of which may be in the PATH
2. **Inaccurate version detection**: When multiple `agent` binaries exist, the version probe may return the wrong version (e.g., Quantex runtime version instead of Cursor CLI version)
3. **Installation mismatch**: Cursor's install script creates symlinks to `cursor-agent`, not `agent`, as the primary interface

## Evidence

- Cursor installs at: `/Users/drs/.local/share/cursor-agent/versions/<version>/cursor-agent`
- Primary executable: `cursor-agent` (with optional `agent` symlink)
- Version probe command in catalog: `["agent", "--version"]`
- Actual reported version can be inconsistent or wrong when multiple `agent` binaries exist

## Solution

**Update the Cursor agent catalog definition** (`src/agents/catalog/cursor.json`) to:

1. Change `binaryName` from `"agent"` to `"cursor-agent"`
2. Update `versionProbe.command` from `["agent", "--version"]` to `["cursor-agent", "--version"]`
3. Update `lookupAliases` to include both `"agent"` and `"cursor"` for backwards compatibility
4. Update `selfUpdate.command` from `["agent", "update"]` to `["cursor-agent", "update"]`

This ensures:
- The version probe targets the correct Cursor binary
- No collision with the Quantex `agent` binary
- Backwards compatibility via lookup aliases
- Consistency with Cursor's actual installation structure

## Impact

- **Fixes**: Accurate version detection for Cursor CLI
- **Backward compat**: `qtx agent` and `qtx cursor` will both continue to work via lookup aliases
- **No breaking changes**: The core behavior remains the same, only the underlying binary reference is corrected
