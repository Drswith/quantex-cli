# Design: Add Mistral Vibe agent support

## Context

Quantex's current install model supports managed package managers (`bun`, `npm`, `brew`, `winget`) plus unmanaged `script` and `binary` commands. Mistral Vibe is distributed as a Python CLI with official shell-install guidance for macOS/Linux and direct `uv` / `pip` install commands.

## Goals / Non-Goals

**Goals:**

- Add Mistral Vibe to the supported agent catalog without changing Quantex's installer abstraction.
- Support the upstream executable and the package-style name users are likely to search for.
- Record install and version metadata using only upstream-documented behavior.

**Non-Goals:**

- Adding a first-class `uv` or `pip` managed installer type.
- Inventing a manual self-update command that upstream does not document.
- Expanding unrelated agent catalog entries beyond README synchronization.

## Decisions

- Use `vibe` as the canonical Quantex slug so the shortcut surface matches the upstream executable.
- Add `mistral-vibe` as a lookup alias so package-name-oriented lookups also resolve correctly.
- Use `vibe` as the binary name and `vibe --version` as the version probe. Upstream source defines `-v` / `--version` through the argparse entrypoint.
- Model the official macOS/Linux install script as an unmanaged `script` method: `curl -LsSf https://mistral.ai/vibe/install.sh | bash`.
- Model `uv tool install mistral-vibe` and `pip install mistral-vibe` as unmanaged `binary` install methods, because Quantex already supports direct command execution for unmanaged installers.
- On Windows, expose the direct `uv` and `pip` install commands instead of a shell script path, because upstream Windows guidance points users to install via `uv`.
- Do not expose a `selfUpdate` command. Upstream documentation describes built-in auto-update behavior and configuration, but does not document a dedicated CLI update subcommand.

## Risks / Trade-offs

- [Managed lifecycle gap] `uv` and `pip` installs remain unmanaged in Quantex, so latest-version lookup and managed update planning are unavailable. This matches the current installer model and avoids inventing unsupported update semantics.
- [Naming ambiguity] `vibe` is shorter than the package name `mistral-vibe`. Adding the package name as a lookup alias keeps user input flexible while preserving a concise command surface.
- [README drift] The supported-agent tables were already behind the registry. Updating them in this change prevents further catalog/doc divergence.

## Migration Plan

- Add the `vibe` agent definition and register it in the catalog.
- Add tests for `vibe` lookup, alias resolution, install methods, and version probing.
- Sync the English and Simplified Chinese README supported-agent tables with the current registry.
- Validate with lint, format check, typecheck, tests, and OpenSpec validation.

## Open Questions

- None.
