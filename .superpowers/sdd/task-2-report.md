# Task 2 Report: Reusable Provider Conformance Harness

## Result

Added a reusable, fresh-subject provider conformance harness covering unsupported optional operations, exact typed failure diagnostics, live-versus-aborted cancellation behavior, effective timeout propagation, provider unavailability, present/absent/indeterminate observation, and exact verification evidence.

`src/providers/invoke.ts` is the production boundary that converts absent optional target or batch operations into typed `unsupported` outcomes. Its overloads keep target requests separate from `update-many` batch requests.

## TDD and review evidence

- Red: the fixture suite initially failed because `test/providers/conformance.ts` did not exist.
- Initial green: fixture conformance passed 7 cases.
- First review rejected false-positive callbacks that could fabricate cancellation, timeout, unsupported, and evidence results.
- The harness now owns live/aborted/timeout contexts, uses control calls, and compares exact diagnostics/evidence. Indeterminate observation became an eighth case.
- Second review rejected test-only unsupported synthesis; focused tests failed until the production invocation boundary and both target/batch overloads existed.
- Final focused result: 2 files / 15 tests passed; independent follow-up review found no blocker or important issue.

## Scope retained

- The harness is proven against a deterministic fixture only.
- Real first-party adapters have not yet invoked it.
- OpenSpec `4.2` remains unchecked until all nine managed provider adapters are migrated and conformant.
- No legacy command, catalog, state, or output behavior changed.
