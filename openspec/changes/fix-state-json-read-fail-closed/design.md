## Approach

- Reuse the existing missing-path error check pattern from `src/utils/lock.ts` (`ENOENT` / `ENOTDIR`) for the missing-state case only.
- Introduce a small `StateFileError` for corrupt or unreadable state files.
- Write to `${statePath}.tmp-${pid}` and `rename` into place to avoid torn writes.

## Non-Goals

- Migrating or repairing corrupt `state.json` automatically.
- Changing `config.json` write semantics in this change.
