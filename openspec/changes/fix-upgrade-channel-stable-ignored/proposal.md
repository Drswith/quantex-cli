## Why

Work-intake classification: this change modifies observable `quantex upgrade --channel` behavior and the self-upgrade channel contract, so OpenSpec is required before file edits.

`quantex upgrade --channel stable` currently drops the explicit channel and falls back to env/config. When `selfUpdateChannel` or `QUANTEX_UPDATE_CHANNEL` is `beta`, an explicit stable request still resolves beta release artifacts or npm tags. That breaks the documented user-controlled channel selection contract and can install a prerelease when the user asked for stable.

## What Changes

- Forward both valid CLI channel values (`stable` and `beta`) into self-upgrade planning instead of only preserving `beta`.
- Keep invalid channel values from being treated as an explicit request (fall back to env/config as today).
- Add a regression covering explicit `--channel stable` overriding a beta config/env default.
- Strengthen the self-upgrade OpenSpec scenario so explicit stable selection is required, not only non-default beta selection.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `self-upgrade`: explicit `--channel stable` MUST override configured/env beta channel selection.

## Impact

- Affected code: `src/cli.ts`, `src/commands/upgrade.ts`
- Affected tests: upgrade command / channel resolution coverage
- Affected specs: `openspec/specs/self-upgrade/spec.md` (via change delta)
- No release workflow, agent catalog, or product README wording changes required for this narrow fix
