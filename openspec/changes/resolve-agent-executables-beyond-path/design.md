## Context

Quantex resolves agent executables with a single primitive, `isBinaryInPath`, which shells out to `which`/`where`. Eight call sites depend on it: install verification, inspection, the observation service, uninstall absence polling, untracked-install adoption, idempotency replay validation, the install-effect provider adapter, and the v1 compatibility export. The Core observation registry carries a second, independent implementation of the same rule in `createExecutableAdapter`. Both are `PATH`-only.

Upstream agent installers overwhelmingly write into a directory they create and then append that directory to a shell profile. The already-running Quantex process never sees the updated `PATH`, so a successful install looks absent. Because `reconcileAgentInstallation` wires a compensator to verification failure, the successful install is then rolled back.

The resolution rule is the narrow waist here: every surface that answers "is this agent available" flows through it, so widening the rule in one place is what keeps install, inspect, list, doctor, uninstall, and execution mutually consistent. Widening only install verification would produce a CLI that installs an agent, reports success, and then reports it absent on the next command.

## Goals / Non-Goals

**Goals:**

- Resolve an agent executable through the inherited `PATH` first, then through a fixed, deterministic set of known install directories.
- Keep one resolution rule shared by the legacy utility path and the Core observation registry so the two cannot drift.
- Make a successful install into a known directory verify and record instead of rolling back.
- Launch and version-probe agents through the resolved absolute path so reported availability matches actual behavior.
- Keep the v1 compatibility export surface byte-identical in names and signatures.

**Non-Goals:**

- Do not modify the user's `PATH` or write to shell profiles. Quantex reads the environment; it does not reconfigure the user's shell.
- Do not search arbitrary or user-configurable directories. An open-ended search would make availability non-deterministic and could resolve an unrelated binary with a colliding name.
- Do not change how provider/package evidence is observed. Executable evidence and provider evidence stay independent inputs to verification.
- Do not add per-agent catalog metadata for install directories. The failure is generic across providers, so a shared rule is correct and a catalog field would be redundant surface.

## Decisions

1. **`PATH` stays authoritative; known directories are a fallback, not a merge.**
   - When `which`/`where` resolves the binary, that result wins unchanged. Only an unresolved lookup consults the known-directory list, in a fixed order.
   - This keeps every currently-working setup bit-identical and confines the new behavior to the case that is failing today.
   - Alternative: always scan directories and prefer the newest binary. Rejected because it would silently change which executable an existing user runs.

2. **The known-directory set is derived from environment and home, and is fixed in code.**
   - The set covers the directories the catalog's own installers actually use: `$HOME/.local/bin`, `$HOME/bin`, `$HOME/.cargo/bin`, `$HOME/.deno/bin` (honoring `DENO_INSTALL_ROOT`), `$HOME/.bun/bin` (honoring `BUN_INSTALL`), and `$HOME/.npm-global/bin`.
   - Deriving from `HOME` rather than hardcoding absolute paths is what makes the disposable-`HOME` canary meaningful, and it is also what makes the rule correct for users with a non-standard home.
   - Alternative: make the list user-configurable. Rejected as scope creep; it adds a config surface for a problem a fixed list solves, and a wrong entry would be hard to diagnose.

3. **Widen `isBinaryInPath` and `getBinaryPath` in place rather than adding parallel functions.**
   - Both names are pinned by the v1 compatibility fixture (`test/fixtures/compatibility/v1/root-exports.json`), so they cannot be removed or renamed.
   - Changing them in place gives all eight call sites the new rule with no caller churn and no risk of a surface being left on the old rule.
   - The cost is that `isBinaryInPath` can now return `true` for an executable outside `PATH`. The new shared module carries the honest names (`resolveAgentExecutablePath`, `isAgentExecutableAvailable`); the two legacy names remain as thin compatibility delegates.
   - Alternative: keep the old functions `PATH`-only and migrate call sites to new names. Rejected because it leaves two live definitions of availability in the codebase, which is the exact drift this change exists to remove.

4. **The Core registry consumes the same directory list through its injected dependencies.**
   - `createExecutableAdapter` already receives `env`, `homeDir`, `platform`, and `access`. The shared module exposes the directory computation as a pure function over those inputs, so the Core path stays dependency-injected and testable without importing process globals.
   - This is what prevents the two implementations from drifting again, which is how the `PATH`-only rule survived in two places until now.

5. **Execution and version probing use the resolved path.**
   - `AgentExecutableObservation` already carries `path`. Execution switches `argv[0]` from the bare binary name to that resolved path when present, and the version probe substitutes the resolved path for `argv[0]` when it matches the binary name.
   - Without this, Quantex would report an agent as installed and then fail to launch it, which is worse than today's behavior.
   - A custom `versionProbe.command` whose `argv[0]` is not the binary name is left untouched, because the catalog author chose that command deliberately.
   - The resolved path is passed in by the caller rather than resolved inside the probe. The observation surfaces have already resolved it, so resolving again would add a `which` spawn per agent to every `list`.

6. **The resolved-path argument lives on `probeInstalledVersion`, not on `getInstalledVersion`.**
   - `dist/index.d.mts` is a byte-pinned compatibility contract (`test/fixtures/compatibility/v1/root-declaration.json`, enforced by `package:check`). Adding even an optional trailing parameter to an exported function changes the emitted declaration and breaks it.
   - `getInstalledVersion` therefore keeps its exact v1 signature and delegates; the widened `probeInstalledVersion` is internal and is not re-exported through `src/compatibility/index.ts`.
   - The same contract is why the three widened compatibility exports are documented with `//` comments rather than JSDoc: JSDoc is emitted into the declaration and would change its bytes.
   - Consequence: the public `getInstalledVersion` export keeps its original PATH-only probe behavior. Quantex's own surfaces all route through `probeInstalledVersion`, so no product behavior depends on the frozen export.

6. **The canary probe asserts the provider's implied lifecycle.**
   - `getInstallLifecycle` classifies script and binary providers as `unmanaged` by construction. The probe's unconditional `managed` assertion has no backing requirement in the `agent-canary-validation` capability and fails every script-only agent once the install path is fixed.
   - The probe instead asserts that the reported lifecycle matches the classification implied by the matrix entry's provider.

## Risks / Trade-offs

- **A stale binary in a known directory can now be resolved.** If a user has an old copy in `~/.local/bin` and a current one on `PATH`, `PATH` still wins, so this only affects the case where nothing is on `PATH` at all — where the alternative is reporting the agent absent.
- **`isBinaryInPath` now under-describes its behavior.** Mitigated by the honestly-named shared module and by the compatibility constraint that forces the old name to persist. The delegate is one line and documents the widening at its definition.
- **Uninstall absence polling widens with the same rule.** This is intended: uninstall must not declare success while a resolvable executable remains, and polling only `PATH` would have reported a false removal for exactly the agents this change makes visible.
