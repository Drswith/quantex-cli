# Design: Add Goose agent support

## Approach

Add a new agent definition file following the established pattern (see `crush.ts`, `kimi.ts`). Goose is a Rust-based CLI with no npm package, so install methods are limited to script-based and Homebrew formula installs.

## Install methods

| Platform | Method | Command |
|---|---|---|
| macOS | script | `curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh \| bash` |
| macOS | brew | `brew install block-goose-cli` |
| Linux | script | `curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh \| bash` |
| Linux | brew | `brew install block-goose-cli` |
| Windows | script (bash) | `curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh \| bash` |
| Windows | script (PowerShell) | `Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aaif-goose/goose/main/download_cli.ps1" -OutFile "download_cli.ps1"; ./download_cli.ps1` |

## Version probe

`goose --version` — standard flag, returns version string.

## Self-update

`goose update` — built-in CLI update command.

## Files changed

- `src/agents/definitions/goose.ts` — new file
- `src/agents/index.ts` — register import, array entry, and re-export
- `openspec/specs/agent-catalog/spec.md` — add Goose requirement section
