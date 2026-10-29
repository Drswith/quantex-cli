# Quantex interface contract

This directory holds everything a human or an agent can observe by invoking `quantex` / `qtx`, captured as data. The Rust implementation is built against these files, not against the TypeScript code it replaces.

## Precedence

When sources disagree, the higher one wins:

1. Contract tests (`tests/contract/`).
2. Data files in this directory (`cli/*.json`, `catalog/`, `fixtures/`).
3. The behaviour notes below.

`2.0.0-beta.1` matches the TypeScript release `v1.13.6`, whose source stays readable in git history (`git show v1.13.6:<path>`). Since 2.0.0-beta.2 the goal is a small, light tool rather than matching v1 everywhere; the differences are listed under [Removed in 2.0.0-beta.2](#removed-in-200-beta2). The detailed v1-era requirement text that used to live in `behavior/` is in git history too (`git show v2.0.0-beta.1:contract/behavior/<file>`).

## Files

| Path | What it locks |
|---|---|
| `cli/registry.json` | Program name, global options, the 11 commands with aliases, arguments, options, effects, and discovery flags |
| `cli/error-codes.json` | The 15 error codes and their exit codes |
| `catalog/*.json` | The 22 supported agents: binary name, install candidates per platform, self-update and version commands |
| `fixtures/state/` | `~/.quantex/state.json` samples: valid, ghost entry, untracked entry, corrupt file |
| `fixtures/release/` | `SHA256SUMS.txt` and `manifest.json` in the release format |

## What is contract

- Command surface: command names, aliases, the bare-agent shortcut (`quantex <agent> [args]`), positional arguments, options and defaults, global flags, environment variables.
- Machine protocol: the `--json` envelope's field names, types, and meanings; `commands --json` content; error codes and exit codes; stdout / stderr routing.
- On-disk formats under `~/.quantex/`: `state.json` (schema v2), `config.json`, `cache/`, `locks/` (an mkdir directory lock holding `owner.json` with a pid). A 1.x build and a 2.x build must be able to share one home directory.
- Distribution and upgrade: npm package name `quantex-cli`, binary names `quantex` and `qtx`, `installSource` values, GitHub release asset names (`quantex-<os>-<arch>.tar.gz`, `quantex-windows-x64.exe.zip`), `SHA256SUMS.txt`, and `manifest.json`. Releases must keep shipping from `Drswith/quantex-cli`, because v1 binaries look there to upgrade.

## Behaviour

- **Observation.** An agent is installed when its executable is found on `PATH` (or at the path its receipt recorded). It is managed when `state.json` records a bun or npm install for it; a script install is recorded but unmanaged; anything else on disk is untracked. Every install, update, and uninstall is checked against a fresh observation before it is recorded, and a receipt (`lifecycleReceipts`) keeps the verified version and executable.
- **install** (`ensure` is an alias). Tries the agent's install methods for this platform in catalog order, with `defaultPackageManager` first. An agent that is already installed is left alone (`ALREADY_INSTALLED`). An untracked executable is adopted when its source is clear (it sits in a bun or npm global directory, or the agent's only install method is its script); any other untracked one is reported and left alone.
- **update.** A managed install is updated through its recorded package manager to the latest release (`npm install -g <package>@latest`, `bun update -g --latest <package>`); a script install runs the agent's own self-update command; an untracked agent is `manual-required`. Quantex never downgrades. `--all` covers every recorded or present agent; `--managed` only recorded ones.
- **uninstall.** Removes a managed install through its package manager, then clears its records. A script install only has its records cleared; the files stay. An agent Quantex has no record of is `UNINSTALL_UNMANAGED` and is left alone.
- **exec and the shortcut.** `exec --install never|if-missing|always`; the shortcut offers to install only when both stdin and stdout are terminals, and otherwise reports `INTERACTION_REQUIRED`. Once the agent runs, its exit code is Quantex's. With `--json`, the agent's stdout and then its stderr are written to stderr after it exits, so stdout holds only the envelope.
- **Locks.** Lifecycle work on an agent holds `locks/agent/<name>.lock`; `state.json` writes hold `locks/state.lock`; self-upgrade holds `locks/self-upgrade.lock`. A lock held by a live process is `RESOURCE_LOCKED`; a dead owner's lock is reclaimed.
- **State compatibility.** Records Quantex cannot manage (an agent no longer in the catalog, or an install type that was removed) are read without error and written back unchanged.
- **Version cache.** Latest-version lookups are cached for 6 hours under `cache/`; `--refresh` forces a lookup and `--no-cache` bypasses the cache.
- **upgrade.** The install source is detected as `binary`, `npm`, `bun`, `source`, or `unknown`. A binary install reads `manifest.json` from the latest GitHub release (the newest prerelease on the `beta` channel), checks the archive's SHA-256, swaps the executable keeping a `.bak`, runs the new binary's `--version`, and rolls back on failure; on Windows the swap happens right after Quantex exits. An npm or Bun install reinstalls `quantex-cli@latest` (`@beta` on the beta channel). Quantex never downgrades itself.

## Intentional differences from v1.13.6

- Human (non-JSON) output is not contract. Wording keeps its meaning; layout, wrapping, width handling, and `--help` text may change.
- In human mode, the envelope's `error` and `warnings` (for example `ALREADY_INSTALLED` and `DRY_RUN` notices) are written to stderr and results to stdout. v1.13.6 printed most of them on stdout. Exit codes are unchanged.
- Argument-parse errors (unknown option, missing argument, invalid option value) report `INVALID_ARGUMENT` with exit code 2, and emit the error envelope with `--json`. v1.13.6 prints a plain stderr line and exits 1.
- The npm package no longer exports a JavaScript library API, and `quantex-core` is not published from this line.

## Removed in 2.0.0-beta.2

- Agents: Auggie CLI, Autohand Code CLI, CodeWhale, Gemini CLI, Goose, Junie CLI, Kiro CLI, Mistral Vibe, OpenHands CLI, Qwen Code, and Reasonix. Their names report `AGENT_NOT_FOUND` like any unknown agent; their `state.json` records are kept.
- Install routes: the `brew`, `winget`, `binary`, `cargo`, `deno`, `mise`, `pip`, and `uv` providers. Every agent installs through bun, npm, or its own script on each platform it supports. `state.json` records with those install types are kept unchanged and treated as untracked. `doctor` checks only bun and npm.
- Output: NDJSON and `--output`; `--json` is the one structured mode, and `meta.mode` is always `json`.
- Options: `--log-level` (it never had an effect) and `--idempotency-key`. Files left under `~/.quantex/idempotency/` are not touched.
- Commands: `capabilities` and `schema`. `ensure` is now an alias of `install`, and `inspect` an alias of `info`, which returns the data `inspect` did (`capabilities` and `inspection.updateLabel` included).
- Config: `npmBunUpdateStrategy` (updates always go to the latest release), `networkRetries` (fixed at 2), and `versionCacheTtlHours` (fixed at 6). `config set` rejects keys it does not know. `defaultPackageManager` accepts `bun` or `npm`; a stored `mise` or `uv` reads as the default, `bun`.

## v1.13.6 defects the Rust build fixes

- Piped stdout is truncated at 64 KiB, so large JSON output piped to `jq` fails.
- With `--json`, `exec` and the shortcut print plain-text lines into stdout ("Dry run: would install …", "Installation cancelled.", launch failures). They now go to stderr; exit codes are unchanged.
- `exec --install <unknown>` and the shortcut's structured-output refusal printed plain text; they now report `INVALID_ARGUMENT` like every other argument error.
- `--timeout` expiring while `exec` observes or runs the agent reported a generic failure with exit code 1. It now reports `TIMEOUT` with exit code 10, as management commands always did.
- `doctor` almost never reported `AGENT_UNTRACKED_IN_PATH`: its read path treated a missing package manager (for example no `bun`) as "could not determine", which made every catalog agent indeterminate. A missing package manager now counts as unavailable, as it already did for `install`, so untracked agents on disk are reported.
- `update` hit the same defect: an agent found only on disk, with no Quantex record, was reported as `failed` ("The recorded update source does not match live provider evidence.") whenever some catalog package manager was missing, so `update --all` exited 1 with `UPDATE_FAILED` on most machines. It is now `manual-required` with the untracked-install message and its `installedVersion`, as v1 intended.
- The shortcut tried to prompt "Would you like to install it?" even without a terminal, and treated the closed stdin as "no" (exit 1). Without a terminal it now reports `INTERACTION_REQUIRED` (exit 7) instead, as `--non-interactive` already did. `data.execution.interactive` reflects the real terminal state accordingly.

## Output mode without an explicit flag

Human output is the default whether or not stdin and stdout are terminals. The v1 documentation promised a switch to structured output on non-TTY streams, but v1 never did it (Node and Bun report `isTTY` as `undefined` for pipes), and changing it now would break `qtx list | grep` style use. Automation passes `--json`. Interactive prompts are only offered when both stdin and stdout are terminals.
