# Proposal: Add Kiro CLI Support

## Summary

Add Kiro CLI (by Amazon) as a supported agent in the Quantex agent catalog.

## Context

Kiro CLI is Amazon's AI-assisted development CLI. It supports installation via curl/PowerShell scripts on macOS, Linux, and Windows, as well as winget on Windows and .deb on Ubuntu. The binary name is `kiro-cli`. It auto-updates in the background.

## Proposed Changes

1. Create `src/agents/definitions/kiro.ts` with:
   - Canonical name: `kiro`
   - Lookup aliases: `kiro-cli`
   - Display name: `Kiro CLI`
   - Binary name: `kiro-cli`
   - Homepage: `https://kiro.dev/cli/`
   - Install methods:
     - macOS: script (`curl -fsSL https://cli.kiro.dev/install | bash`)
     - Linux: script (`curl -fsSL https://cli.kiro.dev/install | bash`)
     - Windows: script (`irm 'https://cli.kiro.dev/install.ps1' | iex`), winget (`Amazon.Kiro`)
   - Version probe: `kiro-cli --version`
   - No self-update command (auto-updates in background; uninstall via `kiro-cli uninstall`)

2. Register the `kiro` agent in `src/agents/index.ts`

3. Add Kiro CLI requirement to `openspec/specs/agent-catalog/spec.md`

## Affected Specs

- `agent-catalog`: new supported agent entry
