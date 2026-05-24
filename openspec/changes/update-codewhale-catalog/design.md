## Context

Upstream DeepSeek TUI documents a rename to CodeWhale starting in `v0.8.41`. The rename changes the dispatcher binary from `deepseek` to `codewhale`, the TUI binary from `deepseek-tui` to `codewhale-tui`, the npm package from `deepseek-tui` to `codewhale`, and the Cargo crates from `deepseek-tui-cli` / `deepseek-tui` to `codewhale-cli` / `codewhale-tui`. Upstream keeps one release-cycle deprecation shims for the old binaries and package.

Quantex already has a supported catalog entry named `deepseek`, and that name is part of lookup behavior, generated exports, tests, and documented command recipes. The user explicitly wants this handled as a breaking rename, so Quantex should move the canonical catalog entry to `codewhale` without preserving legacy lookup aliases.

## Goals / Non-Goals

**Goals:**

- Point Quantex installs, probes, and self-update planning at CodeWhale's current upstream lifecycle surface.
- Make `codewhale` the canonical Quantex catalog name and command shortcut.
- Remove `deepseek` and `deepseek-tui` lookup compatibility from the supported catalog.
- Keep the implementation as catalog metadata, docs, tests, and spec updates only.

**Non-Goals:**

- Add a migration command or rename local user configuration.
- Model upstream deprecation shims as separate Quantex agents.
- Preserve backward compatibility for old catalog names or TypeScript exports.
- Change unrelated DeepSeek provider or Reasonix entries.

## Decisions

### 1. Rename the Quantex canonical catalog name to `codewhale`

The upstream project changed its canonical command, package names, and repository to CodeWhale. This change follows that rename directly: the catalog filename, catalog `name`, generated export, command shortcut, install package metadata, probe, and self-update command all move to `codewhale`. Existing `qtx deepseek` lookup and `deepseek` TypeScript export compatibility are intentionally removed.

### 2. Treat CodeWhale as the current lifecycle surface

Fresh installs should use `codewhale` for npm and `codewhale-cli` for Cargo. Runtime execution, version probing, and self-update planning should use the `codewhale` dispatcher because upstream identifies the old `deepseek` binary as a temporary shim.

### 3. Do not add Homebrew in this change

Upstream's rename guide says Homebrew still uses the legacy formula during the transition. Quantex does not currently model this entry's Homebrew path, so this change keeps the existing npm and Cargo install method types and only updates their package metadata.

## Risks / Trade-offs

- [Existing users may still run `qtx deepseek`] -> Treat the failure as the intended breaking surface for this change and document the new `qtx codewhale` command in product docs.
- [TypeScript consumers importing `deepseek` break] -> The generated export will become `codewhale`; this is part of the requested breaking rename.
- [Cargo install requires multiple crates for full upstream parity] -> Keep the same single-dispatcher Cargo package modeling as the existing entry and point it at `codewhale-cli`; multi-crate modeling remains out of scope unless Quantex needs it separately.
