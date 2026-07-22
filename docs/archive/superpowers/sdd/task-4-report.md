# Task 4 Report: Migrate List And Info Observations

## Result

`list` and `info` now consume `observeRegisteredAgents` and `resolveAgentObservation`, respectively, then pass observations through the existing one-way v1 inspection projection. Their `CommandResult` data and human presenters remain unchanged.

The migration does not expose lifecycle drift, receipts, provider targets, or capability arrays. `inspect`, `resolve`, `capabilities`, `doctor`, mutation/execution commands, and legacy service exports remain on their prior routes.

## TDD evidence

- Red: three command route-boundary tests and one v1 compatibility test failed because `list` and `info` still invoked legacy inspection; the legacy spies intentionally rejected every call.
- Green: the same tests pass with the commands routed through lifecycle observations and the existing v1 projection.
- Route tests lock registry ordering, success/error envelopes, source/update labels, versions, JSON omission behavior, and install-method rendering.
- Review probe: the prior partial assertions still passed after deliberately adding `drift` to `info.data.agent`; the replacement exact fixture failed on that field before the probe was removed.
- Strict compatibility fixtures now lock complete JSON results and NDJSON result events, including `info.data.agent`, `info.data.inspection`, envelope, target, warnings, and metadata.

## Validation

- Brief-focused command and compatibility gate: 3 files / 13 tests passed.
- Lifecycle observation service and v1 projection gate: 2 files / 14 tests passed.
- Format check, lint, and typecheck passed.

## State

- Independent re-review approved Task 4 with no Critical, Important, or Minor findings.
- The controller reran the combined 5-file / 27-test command, compatibility, service, and projection gate plus format, lint, and typecheck successfully.
- OpenSpec `5.3` remains unchecked for controller-owned review and integration closure.
