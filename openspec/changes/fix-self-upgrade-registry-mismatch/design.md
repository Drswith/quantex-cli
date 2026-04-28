## Context

Managed self-upgrade currently uses two independent sources of truth. `inspectSelf()` fetches `latestVersion` from the official npm registry, while Bun and npm upgrades install through the registry configured in the active package manager environment. In mirrored environments this makes `qtx upgrade --check` claim a version is available even when the same command cannot install it, and the Bun/npm providers report success without verifying that the binary version actually changed.

The change crosses config loading, registry-backed version lookup, self-upgrade provider execution, human-facing messaging, and product-facing docs, so a design document helps keep the behavior aligned.

## Goals / Non-Goals

**Goals:**

- Make managed self-upgrade checks and installs use the same resolved registry by default.
- Provide a self-upgrade-only override path so users can opt Quantex into a different registry without changing global package-manager defaults.
- Detect and report post-upgrade version mismatches instead of reporting false success.
- Explain mirror lag clearly in upgrade guidance and troubleshooting docs.

**Non-Goals:**

- Add a global registry flag to every CLI command.
- Change binary self-upgrade release-channel behavior.
- Rework agent install/update registry handling outside of Quantex self-upgrade.

## Decisions

### Resolve a self-upgrade registry with explicit precedence

Quantex will resolve a managed self-upgrade registry in this order:

1. `QTX_SELF_UPDATE_REGISTRY`
2. `selfUpdateRegistry` in Quantex config
3. The active package manager's configured registry
4. Official npm registry as a final fallback

This keeps the default behavior aligned with the user's actual install source while still allowing Quantex-specific opt-in overrides. We are intentionally not introducing a general `--registry` surface in this change to keep the override scoped to self-upgrade.

### Track installable latest separately from upstream latest

For Bun/npm installs, Quantex will treat the selected registry as the authoritative source for availability checks and upgrade targeting. It may also query the official npm registry as a secondary comparison point. When the selected registry lags, Quantex will continue to base `latestVersion` and upgrade decisions on the installable version from the selected registry, but it will emit a warning that upstream is newer.

This avoids false upgrade prompts while still making mirror lag visible.

### Verify managed self-upgrades by re-reading the installed CLI version

After Bun/npm upgrades report success, Quantex will run the current executable with `--version` and compare the observed version to the expected target. If the version does not match, the command will fail with a verification-style error and recovery guidance instead of reporting success.

This mirrors the existing binary self-upgrade safety bar and closes the false-success gap from mirrored registries.

## Risks / Trade-offs

- [Extra registry lookups for upstream comparison] -> Mitigation: only perform the official comparison for managed installs and reuse existing response caching.
- [Package-manager registry detection may differ across user environments] -> Mitigation: support explicit Quantex-only overrides and fall back to official npm only when detection fails.
- [Added config surface can confuse users if over-documented] -> Mitigation: keep README guidance short and move detailed troubleshooting to the runbook.

## Migration Plan

- No stored-state migration is required.
- Existing users keep their current package-manager registry behavior by default.
- Users who want Quantex self-upgrade to bypass a lagging mirror can set `selfUpdateRegistry` or `QTX_SELF_UPDATE_REGISTRY`.
