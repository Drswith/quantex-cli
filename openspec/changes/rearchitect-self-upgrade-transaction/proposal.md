## Why

Work-intake classification: this change restructures Quantex self-upgrade behavior and internal architecture, so it affects observable upgrade behavior and requires OpenSpec before implementation.

Recent self-upgrade bugs have not come from one isolated provider bug; they have come from state leaking across detection, latest-version resolution, provider execution, and post-install verification. The current implementation relies on a flattened `SelfInspection` snapshot that mixes local facts, remote target guesses, and user-facing hints, which makes it too easy for one stale or ambiguous field to corrupt the whole upgrade transaction.

## What Changes

- Refactor self-upgrade internals into explicit phases for install facts, remote target resolution, upgrade planning, and execution/verification.
- Introduce an internal self-upgrade plan object that freezes the install source, resolved target version, registry or release source, and verification strategy before execution starts.
- Make `quantex upgrade`, `quantex upgrade --check`, and `inspectSelf()` derive their status from the same self-upgrade planning logic instead of duplicating update-availability decisions in command code.
- Update managed and binary self-upgrade providers to consume the execution plan rather than infer upgrade targets from loosely related inspection fields.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `self-upgrade`: self-upgrade now resolves an explicit execution-grade plan before provider execution and post-install verification.

## Impact

- Affected code: `src/self/`, `src/commands/upgrade.ts`, and self-upgrade tests.
- Affected contract: `openspec/specs/self-upgrade/spec.md`.
