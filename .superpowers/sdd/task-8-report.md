# Task 8 Report: Review, Normalize, And Deliver Observation Milestone

## Current state

Six review fix waves are complete. Delivery normalization, push, and PR creation remain paused pending another whole-branch re-review.

## Fix evidence

1. Read-only self inspection now detects install source without reconciling or persisting it. Capabilities, doctor, and passive human notices use that path; passive notices retain current output and self target resolution without writing update-notice state. The real CLI smoke no longer pre-fills self source, covers legacy/current/missing self fields plus latest-greater-than-current human output, and compares the complete config-directory file set and bytes after every command.
2. Lifecycle observations now create cancellation and timeout state per invocation. Registry and system provider availability, package presence, and installed-version probes consume the same context. npm, Bun, mise, and uv observation spawns use bounded process-tree termination; providers whose presence probe is a fixed in-process unknown have no child to cancel. A real CLI `--timeout 100ms` case locks the established `TIMEOUT` envelope and exit code, while the production process runner test proves a hanging fake npm process plus grandchild are both terminated after the same 100ms provider deadline.

## Validation

- Focused observation/provider/command/package-manager gate: 16 files / 168 tests passed, followed by the expanded lifecycle gate.
- Read-only smoke: 4 files / 26 tests passed locally.
- Bun 1.3.11 container: 4 files / 26 tests passed after frozen install.
- Full suite: 99 files / 1061 tests passed.
- Format check, lint (0 warnings / 0 errors), typecheck, OpenSpec 16/16, project memory, and build passed.

## Second-wave review findings

1. `capabilities` and `doctor` provider snapshots do not register live CLI cancellation handlers, so hanging probes may survive SIGINT/SIGTERM when no timeout is configured.
2. Context-aware process timeouts can be swallowed by availability and package-probe helpers, degrading typed `timed-out`/`cancelled` outcomes to `unavailable` or `indeterminate`.
3. The latest-greater-than-current passive notice path lacks a positive compatibility assertion proving that human notice output remains while notice state stays unchanged.

## Second-wave fix evidence

1. A shared CLI operation context now supplies invocation-scoped signal and timeout, registers and unregisters one cancellation handler, tracks live work, and joins cleanup before cancellation completes. Lifecycle observations, capabilities, and doctor all use it. Real CLI SIGINT and SIGTERM tests run capabilities without a timeout, require the established exit `11` / `CANCELLED` envelope, and prove the hanging provider parent and grandchild are gone before exit.
2. Context-aware process interruption now crosses helper boundaries as typed `timed-out` or `cancelled` evidence. Contextual adapters wait for process-tree cleanup instead of racing it; legacy no-context boolean/unknown behavior is unchanged. First-party conformance covers timeout and cancellation for all nine managed provider availability probes plus npm, Bun, mise, and uv package-presence and installed-version probes, including clean process trees.
3. Passive human notices now have positive exact-output coverage for latest greater than current while asserting no update-notice setter call. The real CLI baseline requires the exact `99.0.0` notice marker and retains complete config-directory file/byte equality after every command.

## Second-wave validation

- Focused cancellation, provider, command, and package-manager gate: 17 files / 162 tests passed.
- Expanded read-only smoke: 5 files / 28 tests passed locally.
- Bun 1.3.11 container: 5 files / 28 tests passed after frozen install.
- Full suite: 102 files / 1070 tests passed.
- Format check, lint (0 warnings / 0 errors), typecheck, OpenSpec 16/16, project memory, and build passed.

## Third-wave fix evidence

- Third whole-branch review confirmed the typed provider interruption and passive-notice findings are closed, but found that cancellation still joined the entire application promise without a bound. A mixed cache-miss or hanging agent-version task could therefore delay `CANCELLED` even when provider child cleanup succeeded.
- The third fix wave separated application cancellation from explicitly registered resource cleanup. Cancellation races the application promptly, gives registered resources a bounded graceful window, then invokes bounded force cleanup. Process observations and self network fetches consume the shared context; Windows tree cleanup is locked to `taskkill.exe /PID <pid> /T /F`.
- A real no-timeout `doctor` regression combines a self cache miss with hanging provider and agent-version parent/grandchild trees. SIGINT and SIGTERM retain exit `11` and the established `CANCELLED` envelope, finish within the 3-second contract, and leave all four PIDs stopped. Unit coverage also proves never-settling application work cannot block cancellation and never-settling cleanup advances to force cleanup.

## Third-wave validation

- Full suite: 102 files / 1074 tests passed.
- Expanded read-only smoke: 5 files / 28 tests passed locally and in the Bun 1.3.11 container after frozen install.
- Format check, lint (0 warnings / 0 errors), typecheck, OpenSpec 16/16, project memory, and build passed.
- OpenSpec `5.7` is complete again; observation/read-only migration is 7/7 and the full change is 37/74.

## Fourth-wave fix evidence

- Fourth whole-branch review confirmed process cleanup and bounded application cancellation are closed, but found that fetch cancellation ended at response headers. A slow or never-ending response body could outlive cancellation and later write version cache state.
- Network attempts now retain the external invocation signal and per-attempt timeout through request, response-body consumption, and JSON validation. The response reader is an explicit shared cleanup resource; cancellation aborts the request, explicitly cancels the reader with a bounded settle, preserves typed `cancelled` / `timed-out` evidence, and unregisters listeners and cleanup after the complete response lifecycle.
- Version and self-release cache paths recheck cancellation before cache mutation, persistence, fallback freshness, and network freshness. Self binary-release planning preserves typed interruption instead of degrading it to a network-resolution result.
- A real local server returns headers and a partial JSON prefix but never ends the body. Shared-invocation version cancellation, direct self-release cancellation, and a 100ms per-attempt timeout all finish in roughly 110-140ms, close the server stream, and preserve the complete config/cache directory listing and bytes. Existing normal-body, retry, and cache regressions remain green.

## Fourth-wave validation

- Focused network, version, self, runtime, command-runtime, and mixed process-signal gate: 8 files / 93 tests passed.
- Expanded read-only smoke: 5 files / 28 tests passed locally.
- Bun 1.3.11 container with slow-body coverage: 6 files / 32 tests passed after frozen install.
- Full suite: 103 files / 1078 tests passed.
- Format check, lint (0 warnings / 0 errors), typecheck, OpenSpec 16/16, project memory, and build passed.
- OpenSpec `5.7` is complete again; observation/read-only migration is 7/7 and the full change is 37/74.

## Fifth-wave fix evidence

- Fifth whole-branch review confirmed slow-body cancellation and cache safety, but found that an internal network-attempt timeout was incorrectly promoted to command-level typed `TIMEOUT` without an invocation deadline.
- Internal `networkTimeoutMs` exhaustion now uses a private network-attempt error, retains the established retry budget, cancels the active response body with the same bounded cleanup, and returns the legacy unavailable/stale result after retries are exhausted. Only an external invocation signal produces typed `ProcessInterruptionError`; explicit CLI deadlines retain the established `TIMEOUT` envelope.
- Version lookup without invocation context returns `undefined` or an unchanged stale cache entry. Binary self planning maps internal exhaustion to `resolutionError.network`. External version and self cancellation remain typed and close the server stream without cache changes.
- No-timeout `list`, `info`, `capabilities`, and `doctor` retain successful v1 projections with latest-version data unavailable. The six read-only command suites and explicit timeout regressions remain green, as do normal body, retry, HTTP status, cache-hit, and cache-write cases.

## Fifth-wave validation

- Focused network, version, self, command-runtime, six-command, and explicit-timeout gate: 15 files / 133 tests passed.
- Expanded read-only smoke: 5 files / 28 tests passed locally.
- Bun 1.3.11 container network lifecycle plus real CLI smoke: 6 files / 35 tests passed after frozen install.
- Full suite: 104 files / 1082 tests passed.
- Format check, lint (0 warnings / 0 errors), typecheck, OpenSpec 16/16, project memory, and build passed.
- OpenSpec `5.7` is complete again; observation/read-only migration is 7/7 and the full change is 37/74.

## Sixth-wave fix evidence

- Sixth whole-branch review confirmed internal timeout fallbacks, but found a request-before-headers race where transport `AbortError` could beat the already-recorded typed invocation timeout and be swallowed as an ordinary network failure.
- Fetch-attempt arbitration now checks recorded local interruption after any transport rejection, awaits the bounded response cleanup, and then throws the authoritative interruption. Typed invocation cancellation or timeout can upgrade an internal attempt timeout; unrelated transport failures retain legacy retry/fallback behavior.
- Direct headerless transport tests prove a 20ms invocation deadline remains typed `timed-out`, external abort remains typed `cancelled`, and an internal headerless timeout remains legacy `undefined`. Existing headers, body, validation, self, stale-cache, retry, status, cache-hit, and cache-write coverage remains green and cache-safe.
- A real CLI preload keeps fetch pending before headers and rejects immediately when aborted. `capabilities --timeout 100ms` retains exit `10` and the established `TIMEOUT` envelope, emits no late success, and leaves the complete config-directory listing and bytes unchanged.

## Sixth-wave validation

- Focused network, version, self, command-runtime, real CLI, and explicit-timeout gate: 10 files / 101 tests passed.
- Expanded read-only smoke: 5 files / 28 tests passed locally.
- Bun 1.3.11 container network lifecycle, headerless real CLI, and smoke: 7 files / 39 tests passed after frozen install.
- Full suite: 105 files / 1086 tests passed.
- Format check, lint (0 warnings / 0 errors), typecheck, OpenSpec 16/16, project memory, and build passed.
- OpenSpec `5.7` is complete again; observation/read-only migration is 7/7 and the full change is 37/74.

## Recovery state

- Final whole-branch re-review of `7b1dcf5..4066817` found no Critical, Important, or Minor issues and returned `Ready to merge: Yes`.
- Preserve all current checkpoints and fix commits before delivery normalization.
- Next: fetch the latest integration head, retain the checkpoint branch, normalize to one tree-identical commit, rerun the full delivery gate, and create the integration PR.
