## Context

Cargo support added an `installers.cargo` availability flag to `quantex doctor --json`, but `quantex schema doctor` did not include that key in the strict installer schema.

## Decision

Treat the mismatch as schema parity work:

- add `cargo` to the doctor schema installer properties and required list
- leave doctor runtime output unchanged
- add schema assertions so future managed installer additions cannot silently drift

## Risk

The change is intentionally narrow. It only documents a field already present in real doctor JSON output, so the main compatibility effect is that strict validators stop rejecting valid payloads.
