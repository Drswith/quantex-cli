# Task 3 Report: Read-Only Application and v1 Projection Boundary

## Result

Implemented the Task 3 application boundary without migrating any command. `resolveAgentObservation(name)` and
`observeRegisteredAgents()` resolve the canonical registry, run the live observer exactly once per agent, preserve
registry ordering, and combine the observation with current ordered install methods and the values required by the
v1 `AgentInspection` compatibility shape.

The one-way `projectObservationToV1Inspection()` adapter preserves the historical meanings of PATH presence,
binary/resolved paths, installed/latest versions, lifecycle, source label, and update label. It does not expose drift,
receipts, provider targets, or capabilities.

## RED and GREEN evidence

- Initial RED: both focused suites failed to load because `src/services/lifecycle-observations.ts` and
  `src/compatibility/agent-inspection.ts` did not exist.
- Compatibility RED: the service initially did not share installed state with executable inspection, so a tracked
  package-manager version could not preserve legacy precedence. The focused test failed with an undefined version.
- GREEN: the two new suites pass 14 tests, including aliases, unknown agents, canonical ordering, one observation per
  agent, one installed-state read, legacy route boundaries, read-only imports, and six projection states.
- Final focused command gate: 4 files and 23 tests passed.
- `bun run format:check`, `bun run lint`, and `bun run typecheck` passed.

## Compatibility and scope

- `inspectRegisteredAgents` and `resolveAgentInspection` remain unchanged legacy implementations.
- `ensure`, `install`, `run`, `update`, and update planning remain routed through `src/services/agents.ts`.
- No list/info/inspect/resolve/capabilities/doctor command was modified; OpenSpec 5.3-5.6 migration has not started.
- Application and domain code import no output envelope, presenter, Commander, state mutator, or lifecycle lock.
- The service reuses one installed-state read for live observation and managed-version probing, avoiding inconsistent
  evidence within one agent observation.

## Checkpoint and review state

- Checkpoint: `feat(observation): add read-only application boundary` (this commit).
- State: implementation complete; independent review pending.
- OpenSpec: `redesign-lifecycle-engine` remains active and no checkbox was changed.

## Important review fix: raw PATH evidence

Review found that the v1 compatibility adapter projected the observer's merged executable evidence. When PATH was
absent but a tracked provider reported the executable present, the lifecycle observation correctly became
`present` / `conflicting-source`, but v1 incorrectly reported `inPath: true` and exposed provider-derived path and
version values.

- RED: the projection reproduced all four drifted v1 fields; the observer lacked explicit raw PATH evidence; the
  service resolved the provider path instead of the original PATH probe path.
- GREEN: `AgentLifecycleObservationResult.pathExecutable` now preserves the raw executable probe while the existing
  merged `executable` and lifecycle observation remain unchanged. The service resolves only the raw path, and the v1
  adapter derives `inPath`, `binaryPath`, `resolvedBinaryPath`, and `installedVersion` only from raw PATH evidence.
- Review-fix focused gate: 5 files and 47 tests passed; format, lint, and typecheck passed.
- Scope remains Task 3 only: no command route, legacy service, output key, or OpenSpec checkbox changed.
- Planned review-fix commit: `fix(observation): preserve v1 path inspection semantics` (new commit; no amend).
- Independent re-review approved Task 3 with no Critical, Important, or Minor findings.
- The controller reran the 5-file / 47-test focused gate plus format, lint, and typecheck successfully.
