# Design: Add OpenHands CLI support

## Context

OpenHands is a Python-based CLI distributed through an official `uv` install flow plus an official shell installer for macOS and Linux. Its executable command is `openhands`. The OpenHands docs also state that native Windows CLI usage is not officially supported and should run inside WSL, so Quantex should not advertise a native Windows install path.

Autohand is already supported in this repository as a different product with a different executable (`autohand`). This change must add OpenHands alongside Autohand rather than renaming, aliasing, or otherwise mutating the existing Autohand entry.

## Goals / Non-Goals

**Goals:**

- Add OpenHands as a distinct supported lifecycle agent.
- Preserve the existing Autohand definition unchanged.
- Record only upstream-documented lifecycle metadata for install, version probing, and update guidance.

**Non-Goals:**

- Adding a first-class `uv` managed install type in this change.
- Advertising native Windows CLI support when upstream docs require WSL.
- Changing Autohand naming, aliases, or install behavior.

## Decisions

- Use `openhands` as both the canonical Quantex slug and executable name because the upstream CLI command is stable and product-specific.
- Do not add lookup aliases until upstream publishes a stable alternative CLI name worth resolving.
- Model `uv tool install openhands --python 3.12` as an unmanaged `binary` install method on macOS and Linux.
- Model `curl -fsSL https://install.openhands.dev/install.sh | sh` as an unmanaged `script` install method on macOS and Linux.
- Omit `windows` platform metadata because upstream CLI docs explicitly direct Windows users to run the CLI from WSL rather than native PowerShell or Command Prompt.
- Use `openhands --version` as the version probe because the official CLI reference documents `-v` / `--version`.
- Record `uv tool upgrade openhands --python 3.12` as the self-update command because the official install docs publish that upgrade path.

## Risks / Trade-offs

- [Managed lifecycle gap] `uv` installs remain modeled as unmanaged commands, so Quantex will not gain first-class managed latest-version lookup for OpenHands in this change.
- [Platform expectation] Some Windows users may expect a native entry. Omitting a native Windows install path is more accurate than implying support that upstream does not document.
- [Catalog confusion] OpenHands and Autohand are similarly named but different products. Separate canonical slugs and no shared aliases prevent lookup collisions.

## Migration Plan

- Add the `openhands` agent definition and register it in the catalog and root exports.
- Add tests that verify OpenHands lookup, install methods, version probing, and the absence of native Windows platform metadata.
- Update supported-agent tables so OpenHands and Autohand are both listed as distinct supported agents.
- Validate with lint, format check, typecheck, tests, and OpenSpec validation.

## Open Questions

- None.
