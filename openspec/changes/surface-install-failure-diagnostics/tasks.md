## 1. Shared failure projection

- [x] 1.1 Add a pure projection that maps a mutation failure to `CommandError.details` diagnostic fields (`reason`, and `remediation` when present), with no dependency on the CLI or the process. `phase` and `retryable` are deliberately excluded; the legacy engine reports neither, and the differential gate requires the engines to be indistinguishable.
- [x] 1.2 Cover the projection directly: reason present, remediation absent, internal `cause` never emitted.

## 2. Core engine mapping

- [x] 2.1 Rewrite `projectMutationFailure` in `src/commands/core-installation-cli.ts` to attach the projection on every branch instead of discarding `failure.reason` and `failure.remediation`.
- [x] 2.2 Suffix the reason onto the generic `Failed to install <agent>.` message; leave the `recording-failed` and `verification-failed` messages byte-identical.
- [x] 2.3 Split `decision-indeterminate` and `decision-conflict` out of `verificationError()` onto a shared `decision-indeterminate` lifecycle value, with a message that does not claim post-install verification ran. Both share one value because the legacy engine cannot tell them apart.
- [x] 2.4 Set the provider-unavailable marker in `details.lifecycle` when the resolver reports every provider unavailable.

## 3. Legacy engine mapping

- [x] 3.1 Route the `install.ts` failure mapper through the same projection.
- [x] 3.2 Route the `ensure.ts` failure mapper through the same projection.
- [x] 3.3 Assert both engines emit the same payload shape for an equivalent failure.

## 4. Canary probe

- [x] 4.1 Teach the probe in `scripts/smoke/lifecycle-smoke.ts` to read the typed provider-unavailable marker and skip that entry rather than fail.
- [x] 4.2 Report skips by agent name and reason, counted separately from passes, and never as a pass.
- [x] 4.3 Keep every other install failure fatal to the probe.

## 5. Contract coverage

- [x] 5.1 Add contract tests for the new `details` fields on install and ensure failures.
- [x] 5.2 Assert `error.code` and the `verification-failed` detail value are unchanged for a genuine post-mutation verification failure.
- [x] 5.3 Assert a decide-phase indeterminate outcome is no longer reported as a verification failure.
- [x] 5.4 Confirm the v1 compatibility fixtures still pass unmodified.

## 6. Validation

- [x] 6.1 `bun run lint`, `bun run format:check`, `bun run typecheck`.
- [x] 6.2 `bun run test`.
- [x] 6.3 `bun run openspec:validate`.
- [x] 6.4 Reproduce the `genie` canary failure locally against a disposable `HOME` and confirm the reason now names the unavailable `deno` provider.
