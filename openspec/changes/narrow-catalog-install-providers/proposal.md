## Why

The catalog currently reaches into four language ecosystems to install agents: Node (`bun`, `npm`), Rust (`cargo`), Python (`pip`, `uv`), and a polyglot version manager (`mise`). Each additional ecosystem is a separate toolchain Quantex must detect, probe, version-compare, update, and uninstall through — and each one only pays off for the handful of entries that use it. Today `cargo` serves two entries, `mise` one, `uv` two, and `pip` one.

The maintainer has decided to narrow the installation surface to what Quantex actually wants to own: the Node ecosystem plus native binary distribution. `bun`, `npm`, `script`, `binary`, `brew`, and `winget` stay — `brew` and `winget` are operating-system package managers shipping native binaries, which is the same shape as a vendor install script, not the same shape as a language toolchain. `cargo`, `mise`, `pip`, and `uv` become ineligible for catalog entries.

This narrows agent catalog metadata and installation routing, so it is classified as requiring an OpenSpec change before code edits.

## What Changes

- Declare `cargo`, `mise`, `pip`, and `uv` ineligible as catalog install methods, and require every catalog entry to offer at least one eligible method on each platform it claims to support.
- Remove `cargo` from `codewhale` and `vtcode`, `mise` from `codex`, `uv` from `openhands`, and `uv` plus `pip` from `vibe`.
- Drop `vibe`'s Windows platform support. `uv` and `pip` are its only Windows methods, and Mistral Vibe publishes no non-Python Windows installer, so `vibe` becomes a macOS and Linux entry alongside `auggie` and `openhands` rather than keeping a Windows entry Quantex cannot honor.
- Retain the `cargo`, `mise`, `pip`, and `uv` provider implementations. They stay reachable for installations already recorded in state, so an existing `cargo`-installed `codewhale` keeps updating and uninstalling through `cargo`.
- Add the installed-version probe to the `openhands` and `vibe` script candidates. Their version evidence previously rode on the `uv` method, so without this the credential-free canaries for both would silently downgrade from verifying `--version` output to verifying executable presence alone.
- Remove `openhands`'s `uv tool upgrade openhands --python 3.12` self-update command. That command was only correct while `uv` was an install route; the entry's remaining installer downloads a standalone release binary from GitHub and `chmod +x`'s it, so a `uv` upgrade would target a different installation than the one on disk, or fail outright. `openhands` now reports manual update guidance, matching `kiro` and `junie`.

**Not changing** (deliberately):

- No agent leaves the catalog, and no root export is removed. Every affected entry keeps at least one install method on every platform it still claims.
- The `InstallType` union, `catalog.schema.json` provider enum, and the provider registry keep all their members. Removing them would change a published type and schema surface, which is a major-release concern and is explicitly out of scope here.
- `deno` is left alone. Its only consumer is `genie`, whose withdrawal is already proposed in `remove-niche-agent-catalog-entries`. Forbidding `deno` here would strand `genie` with zero install methods and drag this change behind the deferred v2 gate.

## Capabilities

### Modified Capabilities

- `agent-catalog`: add the install-provider eligibility rule, and amend the `CodeWhale`, `Codex`, `OpenHands`, `Mistral Vibe`, and `VTCode` entry requirements whose declared methods change.

### New Capabilities

- None. This narrows an existing surface.

## Impact

- **Not breaking.** No command, flag, schema field, type, export, or persisted-state format changes. This targets a normal minor release and merges to `main` without waiting on the stable v2 readiness gate — unlike `remove-niche-agent-catalog-entries`, which is major-gated.
- **Existing installs keep working.** `getManagedInstallerTypeFromContext` in `src/agent-update/providers.ts` reads `installedState.installType` before it consults catalog methods, and `src/package-manager/capabilities.ts` derives capability from `firstPartyProviderRegistry` rather than from catalog membership. A recorded `cargo`, `mise`, `pip`, or `uv` install therefore keeps its managed update and uninstall path after its catalog method is gone.
- **New installs change route** for `codewhale` (now `npm`), `codex` (now `bun`/`npm`, plus `brew` off Windows), `openhands` (now `script`), `vtcode` (now `script`, plus `brew` off Windows), and `vibe` (now `script`, macOS and Linux only).
- Affected catalog data: `src/agents/catalog/{codewhale,codex,openhands,vibe,vtcode}.json`, with `src/agents/generated/*` and `src/core/generated/*` regenerated.
- Affected tests: `test/agents.test.ts`, `test/catalog-normalized-python-rust.test.ts`, `test/catalog-support-generation.test.ts`, `test/agent-canary-matrix.test.ts`, and the v1 command-family goldens if `list` or `capabilities` output shifts.
- Affected docs: `README.md`, `README.zh-CN.md`, `docs/agent-support-matrix.md`, `docs/generated/agent-provider-support.md`.
- **Known merge interaction**: this change edits `src/agents/catalog/vtcode.json`, which `remove-niche-agent-catalog-entries` deletes. Whichever lands second resolves the delete-versus-modify conflict by taking the deletion.
