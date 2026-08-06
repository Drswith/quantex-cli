## Context

`install.sh` is the public curl-bootstrap path for standalone binaries. After placing the binary it optionally records `self.installSource = "binary"` in `~/.quantex/state.json` via an inline Python snippet.

Today that snippet:

1. On parse failure, keeps an empty default object and overwrites the file — wiping agent lifecycle evidence.
2. Uses `Path.write_text`, which truncates the destination before the new JSON is fully written — torn JSON on interrupt.

The CLI already obeys fail-closed and atomic-write rules in `openspec/specs/quantex-state/spec.md`. Bootstrap installers that mutate the same file must follow the same contract.

## Goals / Non-Goals

**Goals:**

- Prevent `install.sh` from wiping or tearing `state.json` when recording the binary install source.
- Keep binary installation successful even when state recording is skipped due to corrupt existing state.
- Cover the safety shape with a static regression test.

**Non-Goals:**

- Adding state recording to `install.ps1`
- Cross-process locking for installer vs CLI races beyond atomic rename
- Changing Core install/ensure or self-upgrade detection logic

## Decisions

1. **Fail closed, do not fail the binary install**  
   If `state.json` exists but cannot be loaded into a safe object shape, leave it untouched, emit a warning, and still report binary install success. Self-upgrade can later detect a standalone binary from the executable path.

2. **Atomic replace for successful updates**  
   Write complete JSON to a same-directory temporary file, then `os.replace` onto `state.json`.

3. **Preserve existing evidence**  
   When updating a readable document, only set `self.installSource = "binary"` and preserve `installedAgents`, `lifecycleReceipts`, and schema metadata already present.

4. **Static source test**  
   Assert `install.sh` contains fail-closed parse handling and temp-file/`os.replace` write shape, matching the approach used for other installer script regressions.

## Risks / Trade-offs

- [Risk] Users with corrupt state do not get `installSource` persisted by the installer → Mitigation: CLI standalone detection still classifies binary installs; warning tells the user state was left alone.
- [Risk] Concurrent CLI writers can still race with the installer → Mitigation: atomic rename removes truncate tears; full locking is out of scope for this narrow fix.
