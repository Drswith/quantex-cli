# Proposal: add-forgecode-agent

## Summary

Add ForgeCode (by Antinomy) as a supported agent in the Quantex agent catalog.

## Motivation

ForgeCode is an AI-powered coding agent CLI (binary: `forge`) that supports 300+ models and runs on macOS, Linux, and Windows. It has a growing user base and is installable via npm (`forgecode`) and an official curl script. Adding it to the catalog lets Quantex users install, inspect, update, and run ForgeCode through the standard lifecycle commands.

## Proposed changes

1. **New agent definition**: `src/agents/definitions/forgecode.ts`
   - Canonical name: `forgecode`
   - Lookup aliases: `forge`
   - Display name: `ForgeCode`
   - Binary: `forge`
   - Homepage: `https://forgecode.dev`
   - npm package: `forgecode`
   - Self-update command: `forge update`
   - Version probe: `forge --version`
   - Platforms:
     - macOS: `bunInstall()`, `npmInstall()`, `scriptInstall('curl -fsSL https://forgecode.dev/cli | sh')`
     - Linux: `bunInstall()`, `npmInstall()`, `scriptInstall('curl -fsSL https://forgecode.dev/cli | sh')`
     - Windows: `bunInstall()`, `npmInstall()`, `scriptInstall('irm https://forgecode.dev/cli | iex')`

2. **Register in index**: `src/agents/index.ts` — import and add `forgecode` to the agents array and re-export line.

3. **Spec update**: `openspec/specs/agent-catalog/spec.md` — add a `ForgeCode MUST be a supported lifecycle agent` requirement with lookup, install, version probe, and update planning scenarios.

## Affected specs

- `openspec/specs/agent-catalog/spec.md`

## Risks

- The `forge` binary name is generic and could conflict with other tools. Using `forgecode` as canonical name mitigates this.
- No Homebrew or winget install methods documented yet; only npm and script installs are available.
