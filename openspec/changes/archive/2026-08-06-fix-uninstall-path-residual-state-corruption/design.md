## Context

Managed uninstall removes the bound provider package and clears installed-agent state inside `uninstallInstalledAgentOutcome`. The uninstall command then polls until both the bound provider is absent and the agent binary leaves `PATH`. Dual installs of the same binary (for example npm-managed plus another PATH copy) make the PATH half of that postcondition fail even after the managed package is gone. Today's failure path always restores installed-agent state, reinventing ownership for an already-removed package and permanently trapping later uninstalls in `conflicting-source`.

## Goals / Non-Goals

**Goals:**

- Restore evidence only when the bound managed package is still present or provider evidence is inconclusive.
- When the bound provider is conclusively absent after successful removal, clear lifecycle tracking and treat any residual `PATH` binary as untracked rather than Quantex-owned.
- Keep cancellation and provider-still-present verification failures on the current retain-evidence path.

**Non-Goals:**

- Removing residual untracked binaries from `PATH`.
- Changing script/binary state-only uninstall behavior.
- Solving concurrent update/uninstall races outside this postcondition restore path.
- Broad redesign of uninstall error taxonomy.

## Decisions

1. **Re-observe the bound provider after postcondition failure before restoring state.**
   - Alternative: always restore state (current). Rejected because it recreates false ownership when the provider is already absent.
   - Alternative: never restore state. Rejected because provider-still-present failures must keep retry evidence.

2. **Clear receipt and leave installed state absent when provider absence is conclusive.**
   - `uninstallInstalledAgentOutcome` already deleted installed state on success; skipping restore keeps that truth.
   - Clearing the receipt prevents the next uninstall from seeing receipt + absent provider + live PATH as a permanent conflict; retry becomes unmanaged/PATH-only.

3. **Return `conflicting-source` for the residual-PATH outcome.**
   - Matches the planning-time classification for the same evidence shape (provider absent + live PATH).
   - Keeps structured failure distinct from unmanaged and provider-failure outcomes.

## Risks / Trade-offs

- [User sees failure even though the managed package was removed] → Mitigation: message states the managed package was removed and another PATH copy remains; tracking is cleared so `inspect`/`uninstall` can classify the residual binary as unmanaged.
- [Indeterminate provider observation after removal] → Mitigation: keep retain-evidence / verification-failed behavior when provider evidence is not conclusively absent.
