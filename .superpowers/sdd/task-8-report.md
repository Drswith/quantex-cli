# Task 8 Report: Derive Capabilities And Update Buckets

## Result

OpenSpec `4.8` is complete. One compile-time first-party adapter registry now contains every managed, script, and binary provider. The maintained installer capability API derives install, target-version lookup, update, uninstall, and lifecycle results from the adapter operations in that registry.

Planning and service-layer update buckets consume the same derived managed-provider sequence. The historical bun, npm, brew, cargo, deno, mise, pip, uv, winget ordering remains unchanged.

## TDD evidence

- Red: first-party tests failed until the concrete compile-time registry and managed-order projection existed.
- Green: tests compare every compatibility capability with actual registered operations and lock the maintained update order.
- Full compatibility testing caught an accidental new root-package export; the internal helper was removed from the public facade instead of changing the v1 fixture.

## Validation

- Focused provider/update/package-manager suite: 5 files / 100 tests passed.
- Full suite: 76 files / 868 tests passed.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Scope retained

- The v1 root-package runtime export list is unchanged.
- The catalog schema and entries remain in their compatibility shape.
- OpenSpec `4.2` remains unchecked pending the final first-party conformance closure.
- Candidate normalization and generated support documentation remain later provider/catalog tasks.
