# Task 4 Report: Migrate Homebrew And winget Adapters

## Result

OpenSpec `4.4` is complete. Homebrew and winget now expose typed availability, observation, mutation, verification, cancellation, timeout, failure, and evidence behavior. Homebrew preserves formula versus cask identity; winget preserves exact package IDs.

The maintained `ManagedInstaller` entries route through the typed adapters and project typed success back to booleans. Default dependencies still call the existing low-level Homebrew/winget modules through namespace properties.

## TDD evidence

- Red: the system-provider suite failed because the Homebrew/winget adapter modules did not exist.
- Red: compatibility tests proved both `ManagedInstaller` entries still bypassed the typed adapters.
- Green: both adapters pass the shared conformance harness and provider-specific formula/cask/id command assertions.
- The existing cancellation/timeout race was extracted without behavior change into one shared legacy-operation helper rather than duplicated.

## Validation

- Focused provider/compatibility/update suite: 4 files / 106 tests passed.
- Full suite: 72 files / 811 tests passed.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Scope retained

- Default Homebrew/winget presence remains typed `indeterminate` until a real observation probe is introduced; no presence is fabricated.
- Cargo/Deno and later providers remain unmigrated.
- OpenSpec `4.2` remains unchecked until every first-party provider runs the conformance suite.
- Capability-table, update-bucket, catalog, command, and state migration remain untouched.
