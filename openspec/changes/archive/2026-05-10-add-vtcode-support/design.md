## Context

VTCode is distributed as a standalone Rust CLI named `vtcode`. Upstream documentation identifies the native installers as the recommended path, and also documents `cargo install vtcode`, `brew install vtcode`, standard `--version` support through clap, and a built-in update system under `vtcode update`.

Quantex already represents supported agents as lifecycle-focused catalog metadata. The current main branch also includes Cargo as a managed install type, so VTCode can fit the existing catalog shape without adding new package-manager, execution, inspection, or update-planning behavior.

## Goals / Non-Goals

**Goals:**

- Add VTCode as a supported Quantex lifecycle agent with verified upstream metadata.
- Expose official native installers, Cargo install metadata, Homebrew install metadata, version probing, and self-update metadata.
- Keep the implementation limited to the existing agent catalog, README tables, and focused test coverage.

**Non-Goals:**

- Add VTCode-specific runtime integration, prompts, provider configuration, skills, ACP, MCP, or session-management behavior.
- Model the optional search tools bundle or Ghostty VT runtime setup as separate Quantex install methods.
- Add special handling for VTCode release channels, version pins, or mirror configuration beyond exposing the base `vtcode update` command.

## Decisions

### 1. Use `vtcode` as the canonical slug and executable

The upstream package, binary, crate, and documented commands all use `vtcode`. Quantex should therefore expose `vtcode` as the canonical agent name and executable target without adding aliases.

### 2. Record the upstream package metadata that Quantex can manage directly

VTCode publishes a Cargo crate named `vtcode`, and Quantex now supports Cargo as a managed install type. The catalog should set `packages.cargo` to `vtcode` and include `cargoInstall()` on Windows, macOS, and Linux. The Homebrew core formula is documented for macOS/Linux, so the catalog should also include `brewInstall('vtcode')` on those platforms.

### 3. Keep native installers as script install methods

The README documents native macOS/Linux and Windows installer scripts. These are executable install guidance but not managed package-manager methods, so they should be modeled with existing `scriptInstall(...)` entries:

- macOS/Linux: `curl -fsSL https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.sh | bash`
- Windows: `irm https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.ps1 | iex`

### 4. Probe and update through the root dispatcher

The README documents standard `--version` support and the update guide documents `vtcode update` as the check-and-install command. Quantex should use `vtcode --version` for version probes and expose `vtcode update` as the self-update command for installations that support VTCode's built-in updater.

## Risks / Trade-offs

- [Native installers install optional dependencies beyond the core binary] -> Keep only the default documented installer command in Quantex and leave optional search-tool installation to upstream VTCode docs.
- [Cargo installs may not bundle every runtime asset present in native release archives] -> Still expose Cargo because upstream documents it as an alternative install path and Quantex can manage it through the existing Cargo lifecycle.
- [VTCode update channels and pinning are richer than Quantex's current self-update field] -> Store only the base `vtcode update` command and do not model channel or pin flags until Quantex needs that level of update intent.
