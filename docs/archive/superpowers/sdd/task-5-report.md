# Task 5 Report: Migrate Inspect And Resolve Observations

## Result

`inspect` and `resolve` now consume `resolveAgentObservation` and project the resolved observation through the existing one-way v1 inspection boundary. Their human, JSON, and NDJSON result contracts remain unchanged.

Live PATH evidence remains authoritative for installed status. Absent, ghost, conflicting, and indeterminate observations are not reported as installed solely because persisted state or a receipt exists. Managed and untracked installations retain their prior source labels, install sources, lifecycle values, versions, and launch argv.

## TDD evidence

- Red: route and compatibility tests failed while `inspect` and `resolve` still invoked the legacy inspection service; rejecting legacy-service spies made the old route observable.
- Green: both commands now resolve observations and use `projectObservationToV1Inspection` before producing v1 data.
- Command tests cover managed, untracked, absent, ghost, conflicting, indeterminate, alias, unknown-agent, and install-guidance cases.
- Strict JSON and NDJSON fixtures lock `AGENT_NOT_FOUND`, `AGENT_NOT_INSTALLED`, docs references, suggested ensure commands, launch argv, source labels, install sources, and the existing inspect capability object.
- Negative assertions prevent drift, receipts, provider targets, provider capability arrays, and other internal observation evidence from leaking into v1 output.
- Exact human-output fixtures lock installed and unknown `inspect` output plus installed, not-installed guidance, and unknown `resolve` output, including Capabilities, Update Mode, Path, Launch, Install Type, ensure guidance, and unknown-agent text.
- Exact JSON and NDJSON failure fixtures cover both commands' `AGENT_NOT_FOUND` results/events and `resolve`'s `AGENT_NOT_INSTALLED` guidance event, including metadata, warnings, targets, and the NDJSON result wrapper.
- Review probes proved the human fixture catches call-sequence drift and the structured fixture rejects unexpected failure-envelope fields; the probes were removed after RED verification.

## Validation

- Brief-focused command and compatibility gate: 3 files / 23 tests passed.
- Lifecycle observation service and v1 projection gate: 2 files / 14 tests passed.
- Format check, lint, and typecheck passed.

## State

- Independent re-review approved Task 5 with no Critical, Important, or Minor findings.
- The controller reran the combined 5-file / 37-test command, compatibility, service, and projection gate plus format, lint, and typecheck successfully.
- OpenSpec `5.4` remains unchecked for controller-owned review and integration closure.
- `list`, `info`, `capabilities`, `doctor`, mutation/execution commands, and legacy service exports were not changed.
