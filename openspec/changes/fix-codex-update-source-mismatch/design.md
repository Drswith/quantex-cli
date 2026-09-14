## Context

Issue #742 reports two failures on the same update path against published `1.13.4`:

1. Codex-only: `qtx update --all` prints `Updating Codex CLI... (0.154.0 -> latest)` then `Failed to update Codex CLI: The recorded update source does not match live provider evidence.` Claude/Cursor/Grok/Pi succeed. `inspect`/`resolve`/`doctor` still show Codex as managed via bun at `/Users/drs/.local/bin/codex`.
2. Later: after `qtx upgrade` (already current), `qtx update --all` produced no stdout for ~2 minutes, then SIGINT → exit 11. Non-TTY automation defaults to JSON, which emits only after the batch returns, so a long planning phase is indistinguishable from a hang.

Root cause for (1): `confirmedBinding` requires `observation.drift.kind === 'none'`. For a bun-recorded package, bun's observe adapter reports presence/version and does **not** report `executablePath`. Observation still compares the receipt executable path to PATH when versions agree. Codex's native binary/`codex --upgrade` commonly lands on `~/.local/bin` while the receipt still names the bun/npm shim. Same version + different paths → `conflicting-source` → the generic mismatch message. Inspect never uses that drift check; it projects recorded `installType`.

Root cause for (2): `update --all` plans every catalog agent sequentially. Unrecorded, not-on-PATH agents are omitted *after* observation (`isCatalogOnlyAbsentTarget`), but observation still probes every catalog provider (bun/npm/brew). On a Mac with brew available that is tens of slow or lock-prone child processes before any result is emitted. A hung PATH `--version` (Codex TUI) has no per-probe budget unless the user passed `--timeout`.

## Goals / Non-Goals

**Goals:**

- Codex with a still-present recorded bun/npm package can be planned and updated (or reported up to date) instead of failing closed on a stale receipt path.
- `update --all` completes without spending provider-probe time on catalog-only absent agents.
- A hung PATH version probe during update observation becomes unknown version, not a batch stall, unless the command itself is cancelled or timed out.
- Frozen `--json` fields, aliases, exit codes, state v2, and receipt shape stay unchanged.

**Non-Goals:**

- New public flags, commands, or SDK exports.
- Changing default non-TTY JSON-vs-human routing.
- Using `codex --upgrade` as a substitute for a recorded bun/npm source.
- Skipping leftover-package detection on install/ensure observation.
- Merging #741, #134, or catalog slim-down work.

## Decisions

1. **Receipt path is identity for script/binary only.** Package/formula/cask/tool recorded sources use live provider presence as source evidence. Provider-reported `executablePath` (when present) remains compared to PATH regardless of version. Script/binary keep the current same-version / unknown-version path comparison so versioned install directories do not silently switch copies.

   *Alternative considered:* ignore receipt path for every provider. Rejected because script installs have no package identity beyond the receipt path.

2. **Skip catalog provider probes only on the update observation path** when PATH, installed-agent state, and receipt are all absent. Install/ensure keep probing so leftover global packages remain visible.

   *Alternative considered:* parallelize all catalog probes. Rejected as a larger redesign and brew-lock amplifier; skipping work that cannot affect the batch result is the smaller fix.

3. **Per-probe version budget on update/CLI observation inspectExecutable**, capped independently of (and never longer than) command `--timeout`. Timeout of that nested probe is swallowed as unknown version; parent `AbortSignal` still fails the command.

   *Alternative considered:* default command-level `--timeout`. Rejected because it would change global CLI semantics and is already an opt-in flag.

4. **Human-only initial progress line** (`Checking installed agents...`) before batch planning. JSON/ndjson stay a single terminal result. Non-TTY automation that auto-selects JSON is unblocked by faster planning, not by new JSON events.

## Risks / Trade-offs

- [Risk] Two same-version copies (bun shim + `~/.local/bin`) → bun update may refresh the package without changing the PATH binary. → Mitigation: this already matches recorded-source policy; inspect still shows the PATH binary. Fail-closed leftover copies remain when bun reports the package absent.
- [Risk] Skipping catalog probes on update could miss a provider-only leftover with no PATH/state/receipt. → Mitigation: those targets are already omitted from `update --all`; install/ensure still probe.
- [Risk] A 15s version-probe budget could drop a slow but valid `--version`. → Mitigation: unknown version does not by itself create package-source drift after this change; command `--timeout` can be shorter.

## Migration Plan

Ship as a patch bugfix. No state migration. Archive the OpenSpec change after the implementation PR merges and spec deltas are synced.
