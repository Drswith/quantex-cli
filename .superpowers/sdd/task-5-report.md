# Task 5 Report: Migrate Cargo And Deno Adapters

## Result

OpenSpec `4.5` is complete. Cargo and Deno now expose the typed provider contract through the shared system-package adapter. Cargo preserves configured argument ordering and forced reinstall updates; Deno preserves global install argument ordering and executable-name uninstall identity.

The maintained `ManagedInstaller` entries route through the typed adapters and continue projecting typed success to booleans. Their default dependencies preserve the existing low-level call shapes, including absent optional arguments and Deno batch `binaryName` values.

## TDD evidence

- Red: the provider suite failed until Cargo and Deno typed adapters existed.
- Red: existing package-manager tests detected empty arrays replacing optional arguments and missing Deno batch executable names.
- Green: both adapters pass the shared conformance harness and provider-specific command/evidence assertions.
- Compatibility tests prove Cargo arguments and Deno executable names cross the maintained facade without loss.

## Validation

- Focused provider/package-manager/update suite: 6 files / 121 tests passed.
- Full suite: 73 files / 832 tests passed.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Scope retained

- Cargo and Deno presence remains typed `indeterminate` until real observation probes are introduced.
- pip, uv, mise, script, and standalone-binary providers remain unmigrated.
- OpenSpec `4.2` remains unchecked until every first-party provider runs the conformance suite.
- Capability derivation, catalog normalization, commands, and state migration remain untouched.
