# core-installation-soak Delta

## REMOVED Requirements

### Requirement: The second Core-default soak freezes the selected installation boundary

**Reason**: The 1.5 soak time-box and freeze framing are stale at 1.8.x, but the routing contract itself is still live behavior; it is restated without the time-box in the new `installation-routing` capability.

**Migration**: Follow `Install and ensure SHALL route whole invocations to one engine` in `openspec/specs/installation-routing/spec.md`.

### Requirement: The Core-default rollback rehearsal is operator-repeatable

**Reason**: Moved to the new `installation-routing` capability without changes.

**Migration**: Follow the same-named requirement in `openspec/specs/installation-routing/spec.md`.
