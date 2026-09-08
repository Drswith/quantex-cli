# Design: windows-bun-residual-shim-lifecycle

## Context

Install decide is fail-closed on indeterminate observation. Catalog observation currently probes every exact provider. `safelyRun` swallows spawn `ENOENT`, so a missing npm becomes `presence: unknown` → `indeterminate`. The absent-rescue that would let install proceed despite an unresolved alternative requires `!executable.present`. Bun on Windows leaves `{name}.exe` and `{name}.bunx` in its global bin after `bun remove -g`, so PATH stays present and decide blocks with "could not determine the installed state".

The recipe resolver already treats availability `unavailable` as skippable. Observation and decide never consult that distinction. POSIX bun uninstall already removes an unchanged provider-owned symlink; Windows is skipped because those shims are regular files.

## Goals / Non-Goals

**Goals:**

- Missing package-manager executables are typed `unavailable`, not inconclusive presence.
- `qtx install` on a bun-only machine with a leftover Bun global-bin shim decides `install` when bun reports the package absent.
- `qtx uninstall` removes a proven leftover Windows bun shim pair so PATH absence can succeed.
- When that pair cannot be proven or still remains, the uninstall failure names `.exe` and `.bunx` in Bun's global bin.
- Genuine inconclusive probes from an available provider with PATH present stay fail-closed.

**Non-Goals:**

- New commands, flags, aliases, exit codes, state schema, receipt fields, or SDK exports.
- Changing `--json` shape or exposing engine/route.
- Deleting arbitrary regular files, changed shims, or executables outside Bun's global bin.
- Auto-deleting leftover shims during read-only observation.
- Starting issues #734 or #134, cutting a release, or editing GitHub workflow YAML.
- Broad adoption-policy changes for untracked executables that are not leftover Bun global-bin shims.

## Decisions

1. **Map spawn `ENOENT` in the Core package observation adapter, not a new decide code.** `createPackageAdapter.observe` already owns tri-state presence. Distinguishing missing executable there reuses the existing `unavailable` outcome the recipe resolver understands. Alternatives considered: consulting `availability()` before every probe (extra `--version` spawn; `pip` has a multi-binary fallback that `--version` on `pip` would short-circuit), or adding a new public failure code (contract drift).

2. **Skip `unavailable` when aggregating catalog candidates; keep `indeterminate`/`failed` as unresolved.** A missing npm is not evidence about package presence. A broken-but-present npm still fail-closes. Alternatives considered: dropping the fail-closed rule whenever the preferred provider is absent (would re-open PR #399 ghost-probe holes).

3. **Treat a PATH hit under `/.bun/bin/` as non-ownership when bun is conclusively absent and no exact provider is presence-inconclusive.** That unblocks install after uninstall already cleared state but left shims. `pathExecutable` stays present so inspect still reports the leftover on disk; `observation.kind` is `absent` so decide selects `install`. Alternatives considered: adopting the leftover as bun (verify fails because the package is gone), or teaching decide a fifth decision (contract expansion).

4. **Windows shim cleanup mirrors POSIX owned-link cleanup.** Capture `{bin}/{name}.exe` plus `{bin}/{name}.bunx` as regular files in `bun pm bin -g` before removal, require the package to declare that binary, then unlink only if both files are unchanged after bun reports the package absent. Do not parse `.bunx` internals. Alternatives considered: post-only delete of any `.exe` in bun bin (too broad), or guidance-only (leaves already-stuck uninstall reporting failure and does not clear PATH).

5. **Guidance is a fallback, not the primary repair.** If the pair remains, the existing conflicting-source uninstall failure adds a sentence naming `<binary>.exe` and `<binary>.bunx` in Bun's global bin. No new error code.

## Risks / Trade-offs

- [Risk] A coincidental executable in `~/.bun/bin` is treated as a leftover → Mitigation: require bun conclusively absent, no live exact provider, and the `/.bun/bin/` path heuristic; uninstall deletion additionally requires the `.bunx` sidecar, package-declared binary, and unchanged file identity.
- [Risk] Custom `BUN_INSTALL` paths without `.bun/bin` miss the install leftover heuristic → Mitigation: uninstall cleanup uses `bun pm bin -g`; after a successful uninstall PATH is clear and the unavailable-skip path is enough.
- [Risk] Treating leftover PATH as observation-absent while inspect still shows on-disk presence surprises users → Mitigation: inspect already used `pathExecutable`; install then replaces the dead shim. Prefer unblocking install over hiding the leftover from inspect.
- [Risk] Broad ENOENT→unavailable changes brew/cargo/etc. probes → Mitigation: only spawn `ENOENT` (and `ENOTDIR`) maps to unavailable; non-zero exits and empty/unparseable output stay unknown/indeterminate.

## Migration Plan

1. Land observation, bun shim cleanup, guidance, and tests together.
2. Do not tag a release in this PR; release-please consumes the user-facing `fix:` override after merge.

## Open Questions

None. Upstream bun#11970 remains open; this change only reconciles Quantex-owned leftovers.
