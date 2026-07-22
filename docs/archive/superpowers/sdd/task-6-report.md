# Task 6 Report: Derive Capabilities And Doctor Diagnostics

## Result

`capabilities` and `doctor` now consume one shared provider snapshot derived from
`firstPartyProviderRegistry.list()`, `getCapabilities(id)`, and each adapter's typed `availability` operation.
The strict v1 installer projection remains exactly the existing nine managed providers; script and binary adapters
remain available to the internal registry without appearing in the v1 `installers` object.

`doctor` now consumes live lifecycle observations and uses observation drift for agent diagnostics. The v1 agent,
installer, self-upgrade, issue, blocking, remediation, platform-reason, feature, JSON, and human projections remain
unchanged. Explicitly network-aware `inspectSelf()` checks remain scoped to these commands; no other command gained a
network effect.

After review, the v1 feature projection also consumes a command capability snapshot derived from the authoritative
command-contract registry flags and effects. The projection preserves every existing v1 feature field and value while
removing the command module's duplicated support booleans.

## TDD Evidence

- Red: provider snapshot tests failed on the unimplemented snapshot and projection behavior.
- Red: command route tests rejected every direct `is*Available` call; both legacy command routes failed.
- Green: each registered adapter availability operation is invoked once, capabilities are obtained from the registry,
  and cancelled, timed-out, and unavailable outcomes retain their typed form.
- Green: command tests lock the nine strict installer keys, platform reasons, feature fields, self-upgrade projection,
  installer booleans, established issue codes, blocking flags, remediation commands, and live-drift routing.
- Negative projections prove script/binary providers and internal observation fields do not leak into v1 output.
- Review RED removed `--yes`/`--refresh` and upgrade mutation/network effects from a registry fixture; the previous
  hard-coded command projection incorrectly remained true.
- Review GREEN derives feature support from registry flags/effects and uses a real timed-out provider observation to
  prove indeterminate live drift does not fabricate an untracked-agent issue or alter established self remediation.

## Validation

- Brief-focused gate: 4 files / 30 tests passed.
- Observation and v1 protocol gate: 4 files / 36 tests passed.
- Full suite: 95 files / 1034 tests passed.
- Format check, lint, and typecheck passed.

## State

- Independent re-review approved Task 6 with no Critical, Important, or Minor findings.
- The controller reran the combined 8-file / 58-test provider, command, observation, compatibility, inspect, and resolve gate plus format, lint, and typecheck successfully.
- OpenSpec `5.5` and `5.6` remain unchecked for controller-owned review and integration closure.
- Other read-only commands, mutation/execution paths, legacy routes, provider adapters, state, and self-upgrade behavior
  were not changed.
