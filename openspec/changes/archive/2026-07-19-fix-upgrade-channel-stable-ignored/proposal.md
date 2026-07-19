## Why

Work-intake classification: this change modifies observable `quantex upgrade --channel` behavior and the self-upgrade channel contract, so OpenSpec is required before file edits.

`quantex upgrade --channel stable` currently drops the explicit channel in `command-contract/handlers.ts` and falls back to env/config. When `selfUpdateChannel` or `QUANTEX_UPDATE_CHANNEL` is `beta`, an explicit stable request still resolves beta release artifacts or npm/bun tags. That breaks user-controlled channel selection and can install a prerelease when the user asked for stable.

Supersedes the stale pre-redesign attempt in PR #455, which targeted removed `src/cli.ts` wiring and now conflicts with main.

## What Changes

- Forward both valid CLI channel values (`stable` and `beta`) into self-upgrade planning instead of only preserving `beta`.
- Keep invalid channel values from being treated as an explicit request (fall back to env/config as today).
- Add regression coverage for explicit `--channel stable` overriding a beta config/env default.
- Strengthen the self-upgrade OpenSpec scenario so explicit stable selection is required, not only non-default beta selection.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `self-upgrade`: explicit `--channel stable` MUST override configured/env beta channel selection.

## Impact

- Affected code: `src/command-contract/handlers.ts`, `src/commands/upgrade.ts`
- Affected tests: upgrade command / channel resolution coverage
- Affected specs: `openspec/specs/self-upgrade/spec.md` (via change delta)
- No release workflow, agent catalog, or product README wording changes required for this narrow fix
