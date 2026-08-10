## Why

Quantex treats "the executable resolves through the inherited `PATH`" as the only definition of an agent being available. Most upstream installers write the executable into a directory they create and then append to a shell profile, so the directory is not on the `PATH` of the already-running Quantex process. Install verification therefore fails, and because verification failure triggers the installation compensator, Quantex **uninstalls the agent it just installed successfully** and reports `INSTALL_FAILED / verification-failed`.

The first full-scope scheduled run of the agent canary workflow made the blast radius concrete: twelve catalog agents failed this way on a disposable `HOME`, including antigravity, cursor, devin, goose, kiro, and vtcode. The same failure hits any real user whose fresh machine does not already carry `~/.local/bin` on `PATH`.

This implementation request is classified as an observable-CLI-behavior and lifecycle-contract change and therefore requires an OpenSpec contract before code edits.

## What Changes

- Redefine agent executable resolution as "inherited `PATH` first, then a deterministic set of known agent install directories", replacing the current `PATH`-only rule. `PATH` stays authoritative when it resolves.
- Apply the single resolution rule consistently across install verification, inspection, `list`, `doctor`, uninstall absence polling, adoption of untracked installs, idempotency replay validation, and the Core provider observation registry, so every surface agrees on whether an agent is available.
- Launch agents through the resolved absolute executable path instead of the bare binary name, so `quantex <agent>` runs an agent that Quantex reports as installed.
- Probe installed versions through the resolved absolute path, so `inspect` and `list` expose `installedVersion` for agents that resolve outside `PATH`.
- Fix the canary probe scenario's unconditional `lifecycle === 'managed'` assertion, which contradicts the existing capability contract for script- and binary-provider agents.

Non-goals: Quantex does not modify the user's `PATH`, does not write to shell profiles, and does not search arbitrary directories. The known-directory set is fixed and derived from the environment and home directory.

## Capabilities

### Modified Capabilities

- `lifecycle-reconciliation`: executable presence evidence, and therefore install verification and compensation, is defined over the resolution rule rather than over `PATH` membership.
- `agent-canary-validation`: the probe scenario asserts the lifecycle classification implied by the selected provider instead of requiring `managed` for every agent.

### New Capabilities

- None. This changes the meaning of existing evidence rather than adding a capability.

## Impact

- Affected code: `src/utils/detect.ts`, `src/utils/version.ts`, a new shared resolution module, `src/core/provider-observation-registry.ts`, `src/services/lifecycle-execution.ts`, and `src/services/lifecycle-observations.ts`.
- Affected behavior: a successful install into a known directory now verifies and is recorded instead of being rolled back; `inspect`, `list`, and `doctor` report such agents as installed with a resolved path and version.
- Affected tests: `test/utils/detect.test.ts`, `test/utils/version.test.ts`, Core observation registry coverage, and the command suites that stub executable presence.
- The v1 compatibility surface is unchanged: `isBinaryInPath` and `getBinaryPath` keep their exported names and signatures, and only their resolution rule widens. The packaged root declaration stays byte-identical to the pinned contract, so `package:check` passes without editing the fixture.
- No CLI flags, persisted state formats, structured-output schemas, or agent catalog entries change.
