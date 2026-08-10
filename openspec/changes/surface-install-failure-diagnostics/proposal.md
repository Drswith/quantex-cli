## Why

When a lifecycle mutation fails anywhere other than the recording or verification phase, Quantex replaces the resolver's diagnostic with the fixed string `Failed to install <agent>.` The resolver already produces an accurate reason — `No installation provider is currently available: deno: ...`, `install effect failed with exit code 1` — and `projectMutationFailure` discards both it and the attached remediation. Nothing recovers it: `--json` carries no `details`, and `--log-level debug` prints only the engine route.

The first full-scope scheduled agent-canary run made the cost concrete. Four of the five failures left after `resolve-agent-executables-beyond-path` could not be triaged from their job logs, because every one of them reported only `Failed to install X.` Two required reading upstream installer sources and measuring a CDN by hand to reconstruct what Quantex already knew and threw away. One (`genie`) is not a defect at all: the runner has no `deno`, so no provider is available, and an advisory canary should skip it rather than report a red install.

Work intake classification: this change alters the structured `--json` error payload for install and ensure failures and alters agent-canary pass/fail behavior, so it is OpenSpec-gated rather than a mechanical cleanup.

## What Changes

- Install and ensure failure results carry the underlying typed failure reason and any provider remediation in `error.details`, instead of collapsing every non-recording, non-verification failure to `Failed to install <agent>.`
- A decide-phase `decision-indeterminate` outcome stops being reported as `X could not be verified after installation`. Nothing was installed and no verification ran, so the payload distinguishes an undetermined decision from a genuine post-install verification failure.
- The agent-canary probe treats "no installation provider is currently available" as a skip rather than a failure, so the canary reports on Quantex and upstream installers rather than on which toolchains a runner image happens to ship.
- Human output gains the same reason on the failure line; it stays a single line and does not become a stack dump.
- Not changed: the typed outcome kinds themselves, provider selection, and the rule that Quantex never branches reconciliation on free-form message text. The surfaced reason is diagnostic payload only.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lifecycle-reconciliation` — mutation failures MUST expose the typed failure reason for diagnosis, and a decide-phase indeterminate outcome MUST NOT be reported as a verification failure.
- `agent-canary-validation` — the probe MUST skip a matrix entry whose providers are all unavailable on the runner.

## Impact

- `src/commands/core-installation-cli.ts` — `projectMutationFailure`, the site that discards `failure.reason` and `failure.remediation`.
- `src/commands/install.ts`, `src/commands/ensure.ts` — the legacy-engine failure mappers, which collapse the same way and must not disagree with the Core engine.
- `scripts/smoke/lifecycle-smoke.ts` — probe skip handling for an unavailable-provider result.
- Structured output contract: `error.details` gains diagnostic fields on install and ensure failures. `error.code` and the existing `details.lifecycle` values are unchanged, so no consumer keying on those breaks.
- `test/` — contract coverage for the new payload and for the decide-phase distinction.

## Non-Goals

- Provisioning additional toolchains (`deno`, `uv`) in the canary workflow.
- Changing how providers are selected, or adding retry behavior for slow upstream downloads.
- Fixing `vibe`, whose upstream installer exits non-zero after a successful install purely because `~/.local/bin` is absent from `PATH`; that is a separate contract question about trusting an installer's exit code.
- Re-labelling `sourceLabel`, already recorded as out of scope by `resolve-agent-executables-beyond-path`.
