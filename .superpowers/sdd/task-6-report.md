# Task 6 Report: Migrate pip, uv, And mise Adapters

## Result

OpenSpec `4.6` is complete. pip, uv, and mise now expose typed availability, observation, mutation, verification, cancellation, timeout, failure, and evidence behavior. uv preserves tool arguments; uv and mise project parsed installed versions into typed observations.

The maintained `ManagedInstaller` entries route mutations through typed adapters and project typed success back to booleans. Existing uv/mise presence and installed-version methods remain direct compatibility projections, while default adapter dependencies retain the existing low-level module call shapes.

## TDD evidence

- Red: the provider suite failed until pip, uv, and mise typed adapters existed.
- Red: compatibility tests proved their maintained installer entries still bypassed typed adapters.
- Green: all three adapters pass the shared conformance harness, including typed version observations for uv and mise.
- The shared system-package adapter now uses explicit operation identities in diagnostics instead of inferring them from provider-specific command positions.

## Validation

- Focused provider/package-manager/update suite: 6 files / 144 tests passed.
- Full suite: 74 files / 860 tests passed.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Scope retained

- pip presence remains typed `indeterminate`; no package-state probe is fabricated.
- Script and standalone-binary candidates remain unmigrated.
- OpenSpec `4.2` remains unchecked until every first-party provider runs the conformance suite.
- Capability derivation, catalog normalization, commands, and state migration remain untouched.
