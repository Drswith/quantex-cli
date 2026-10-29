# Quantex interface contract

This directory holds everything a human or an agent can observe by invoking `quantex` / `qtx`, captured as data. The Rust implementation is built against these files, not against the TypeScript code it replaces.

## Precedence

When sources disagree, the higher one wins:

1. Contract tests (`tests/contract/`), run against both the Rust build and the reference binary.
2. Data files in this directory (`cli/*.json`, `catalog/`, `fixtures/`).
3. Behaviour notes in `behavior/`.

The reference binary is the published TypeScript release `v1.13.6`. Its source stays readable in git history (`git show v1.13.6:<path>`). Since 2.0.0-beta.2 the goal is a small, light tool rather than matching v1 everywhere; the differences are listed under [Removed in 2.0.0-beta.2](#removed-in-200-beta2).

## Files

| Path | What it locks |
|---|---|
| `cli/registry.json` | Program name, global options, the 15 stable commands with aliases, arguments, options, effects, and discovery flags |
| `cli/schemas.json` | JSON Schema documents returned by `quantex schema` (envelope, data, NDJSON event per command) |
| `cli/error-codes.json` | The 15 error codes and their exit codes |
| `catalog/*.json`, `catalog.schema.json` | The 22 supported agents and the catalog schema |
| `fixtures/state/` | `~/.quantex/state.json` samples: valid, ghost entry, untracked entry, corrupt file |
| `behavior/*.md` | Behaviour requirements imported from the v1.13.6 specifications, minus TypeScript-engine routing |

## What is contract

- Command surface: command names, aliases, the bare-agent shortcut (`quantex <agent> [args]`), positional arguments, options and defaults, global flags, environment variables.
- Machine protocol: JSON / NDJSON envelope field names, types, and meanings; `commands --json` and `schema --json` content; error codes and exit codes; stdout / stderr routing.
- On-disk formats under `~/.quantex/`: `state.json` (schema v2), `config.json`, `cache/`, `idempotency/`, `locks/` (an mkdir directory lock holding `owner.json` with a pid). A TypeScript build and a Rust build must be able to share one home directory.
- Distribution and upgrade: npm package name `quantex-cli`, binary names `quantex` and `qtx`, `installSource` values, GitHub release asset names (`quantex-<os>-<arch>.tar.gz`, `quantex-windows-x64.exe.zip`), `SHA256SUMS.txt`, and `manifest.json`. Releases must keep shipping from `Drswith/quantex-cli`, because v1 binaries look there to upgrade.

## Intentional differences from v1.13.6

- Human (non-JSON) output is not contract. Wording keeps its meaning; layout, wrapping, width handling, and `--help` text may change.
- In human mode, the envelope's `error` and `warnings` (for example `ALREADY_INSTALLED` and `DRY_RUN` notices) are written to stderr and results to stdout. v1.13.6 printed most of them on stdout. Exit codes are unchanged.
- Argument-parse errors (unknown option, missing argument, invalid option value) report `INVALID_ARGUMENT` with exit code 2, and emit the error envelope in `json` / `ndjson` mode. v1.13.6 prints a plain stderr line and exits 1.
- The npm package no longer exports a JavaScript library API, and `quantex-core` is not published from this line.

## Removed in 2.0.0-beta.2

- Auggie CLI, Autohand Code CLI, CodeWhale, Gemini CLI, Goose, Junie CLI, Kiro CLI, Mistral Vibe, OpenHands CLI, Qwen Code, and Reasonix are no longer in the catalog. Their names report `AGENT_NOT_FOUND` like any unknown agent; their `state.json` records are kept.
- The `cargo`, `deno`, `mise`, `pip`, and `uv` providers are gone; no catalog agent used them. `state.json` records with those install types are kept unchanged and treated as untracked.
- `capabilities` and `doctor` report only the package managers the catalog uses on this platform: `bun` and `npm`, plus `brew` on macOS and Linux or `winget` on Windows. An unavailable one always has `reason: "not-found"`.
- `defaultPackageManager` accepts `bun` or `npm`. A stored `mise` or `uv` reads as the default, `bun`.

## v1.13.6 defects the Rust build fixes

- Piped stdout is truncated at 64 KiB, so `quantex schema --json | jq` fails.
- In `json` / `ndjson` mode, `exec` and the shortcut print plain-text lines into stdout ("Dry run: would install …", "Installation cancelled.", launch failures). They now go to stderr; exit codes are unchanged.
- `exec --install <unknown>` and the shortcut's structured-output refusal printed plain text; they now report `INVALID_ARGUMENT` like every other argument error.
- `--timeout` expiring while `exec` observes or runs the agent reported a generic failure with exit code 1. It now reports `TIMEOUT` with exit code 10, as management commands always did.
- `doctor` almost never reported `AGENT_UNTRACKED_IN_PATH`: its read path treated a missing package manager (for example no `bun`) as "could not determine", which made every catalog agent indeterminate. A missing package manager now counts as unavailable, as it already did for `install`, so untracked agents on disk are reported.
- `update` hit the same defect: an agent found only on disk, with no Quantex record, was reported as `failed` ("The recorded update source does not match live provider evidence.") whenever some catalog package manager was missing, so `update --all` exited 1 with `UPDATE_FAILED` on most machines. It is now `manual-required` with the untracked-install message and its `installedVersion`, as v1 intended.
- `--idempotency-key` with several `install` targets printed the result, then exited 1 with a stack trace because v1 rejected its own record; nothing was recorded. `update --all` with a key and nothing to update failed the same way. Both now exit 0, and the batch-install record replays.
- `uninstall --idempotency-key` never replayed: the missing-package-manager defect above made the absence check inconclusive. It now replays while the agent stays removed.
- The shortcut tried to prompt "Would you like to install it?" even without a terminal, and treated the closed stdin as "no" (exit 1). Without a terminal it now reports `INTERACTION_REQUIRED` (exit 7) instead, as `--non-interactive` already did. `data.execution.interactive` reflects the real terminal state accordingly.

## Output mode without an explicit flag

Human output is the default whether or not stdin and stdout are terminals. The v1 documentation promised a switch to structured output on non-TTY streams, but v1 never did it (Node and Bun report `isTTY` as `undefined` for pipes), and changing it now would break `qtx list | grep` style use. Automation passes `--json` or `--output json|ndjson`. Interactive prompts are only offered when both stdin and stdout are terminals.
