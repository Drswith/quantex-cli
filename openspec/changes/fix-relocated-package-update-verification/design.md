## Context

`#743` stopped comparing a package/formula receipt path against PATH. It still compares PATH `--version` with the bound provider version. That is harmless while both are `0.154.0`. After `bun update -g @openai/codex` the provider reports `0.155.0` while PATH can remain `~/.local/bin/codex` at `0.154.0`. Observation then returns `conflicting-source`, `verifyUpdatedObservation` fails, and the receipt is not refreshed.

## Goals / Non-Goals

**Goals:**

- Let a recorded bun/npm/formula update complete when PATH relocated off the receipt shim and still reports the previous binary version.
- Project the bound provider version as the managed version in that relocation case so planning and verification agree.
- Keep provider-reported vs PATH executable-path conflicts fail-closed.

**Non-Goals:**

- Substituting `codex --upgrade` for a recorded package source.
- Updating or replacing the leftover PATH binary.
- Changing inspect/doctor display contracts beyond the managed version that observation already projects.
- Changing script/binary receipt-path comparison.

## Decisions

- Detect package/formula PATH relocation from receipt path vs live PATH identity. Only then ignore PATH vs provider version as source drift and prefer the provider version.
- Leave same-path version mismatches fail-closed (`reports conflicting provider and executable versions against recorded ownership`).
- Do not skip presence mismatch, provider-reported path conflict, or executable-identity conflict.

## Risks / Trade-offs

- [Risk] A leftover PATH binary can stay old after a reported successful package update. → Mitigation: this matches the `#743` product choice to mutate the recorded package; verification now reports that package result honestly.
- [Risk] Missing receipt `executablePath` cannot detect relocation, so version skew stays fail-closed. → Mitigation: conservative and matches current receipts that record the shim path.
