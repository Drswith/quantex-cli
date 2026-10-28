# Quantex interface contract

This directory holds everything a human or an agent can observe by invoking `quantex` / `qtx`, captured as data. The Rust implementation is built against these files, not against the TypeScript code it replaces.

## Precedence

When sources disagree, the higher one wins:

1. Contract tests (`tests/contract/`), run against both the Rust build and the reference binary.
2. Data files in this directory (`cli/*.json`, `catalog/`, `fixtures/`).
3. Behaviour notes in `behavior/`.

The reference binary is the published TypeScript release `v1.13.6`. Its source stays readable in git history (`git show v1.13.6:<path>`).

## Files

| Path | What it locks |
|---|---|
| `cli/registry.json` | Program name, global options, the 15 stable commands with aliases, arguments, options, effects, and discovery flags |
| `cli/schemas.json` | JSON Schema documents returned by `quantex schema` (envelope, data, NDJSON event per command) |
| `cli/error-codes.json` | The 15 error codes and their exit codes |
| `catalog/*.json`, `catalog.schema.json` | The 33 supported agents and the catalog schema |
| `fixtures/state/` | `~/.quantex/state.json` samples: valid, ghost entry, untracked entry, corrupt file |
| `behavior/*.md` | Behaviour requirements imported from the v1.13.6 specifications, minus TypeScript-engine routing |

## What is contract

- Command surface: command names, aliases, the bare-agent shortcut (`quantex <agent> [args]`), positional arguments, options and defaults, global flags, environment variables.
- Machine protocol: JSON / NDJSON envelope field names, types, and meanings; `commands --json` and `schema --json` content; error codes and exit codes; stdout / stderr routing.
- On-disk formats under `~/.quantex/`: `state.json` (schema v2), `config.json`, `cache/`, `idempotency/`, `locks/` (an mkdir directory lock holding `owner.json` with a pid). A TypeScript build and a Rust build must be able to share one home directory.
- Distribution and upgrade: npm package name `quantex-cli`, binary names `quantex` and `qtx`, `installSource` values, GitHub release asset names (`quantex-<os>-<arch>.tar.gz`, `quantex-windows-x64.exe.zip`), `SHA256SUMS.txt`, and `manifest.json`. Releases must keep shipping from `Drswith/quantex-cli`, because v1 binaries look there to upgrade.

## Intentional differences from v1.13.6

- Human (non-JSON) output is not contract. Wording keeps its meaning; layout, wrapping, width handling, and `--help` text may change.
- Argument-parse errors (unknown option, missing argument, invalid option value) report `INVALID_ARGUMENT` with exit code 2, and emit the error envelope in `json` / `ndjson` mode. v1.13.6 prints a plain stderr line and exits 1.
- The npm package no longer exports a JavaScript library API, and `quantex-core` is not published from this line.

## v1.13.6 defects the Rust build fixes

- Piped stdout is truncated at 64 KiB, so `quantex schema --json | jq` fails.
- With a non-TTY stdin or stdout the documented default is structured output; the v1.13.6 binary still prints human output unless `--json` or `--output` is passed.
