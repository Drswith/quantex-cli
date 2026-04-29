## Context

Crush (by Charmbracelet) is a Go-based terminal AI coding agent with broad multi-platform install support. Quantex's agent catalog needs a new definition entry following the established pattern in `src/agents/definitions/`.

## Goals / Non-Goals

**Goals:**
- Add Crush as a supported agent with all known install methods
- Follow the existing agent definition pattern exactly

**Non-Goals:**
- No changes to Quantex core, CLI surface, or catalog schema
- No changes to install resolution or update planning logic

## Decisions

- **Homebrew tap over core formula**: Use `charmbracelet/tap/crush` (the official Charm tap) as the Homebrew install method, matching the README recommendation.
- **No script install method**: Crush does not advertise a curl-to-shell install script in its README. The available methods are Homebrew, npm, winget, scoop, apt/yum repos, Go install, and binary download. We register Homebrew, npm/bun, and winget as the primary managed methods.
- **Self-update**: Crush supports `crush update` for self-updating.
- **Version probe**: `crush --version` is the standard version check.

## Risks / Trade-offs

- [Homebrew tap path format] → The `brewInstall` helper takes a `packageName` string. For taps, the convention is to pass the full tap reference (e.g., `charmbracelet/tap/crush`). This is consistent with how other agents use brew.
