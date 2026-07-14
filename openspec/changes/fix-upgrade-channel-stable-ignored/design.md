## Context

Self-upgrade channel resolution already prefers an explicit requested channel:

1. requested CLI channel
2. `QUANTEX_UPDATE_CHANNEL`
3. config `selfUpdateChannel`
4. default `stable`

The CLI option handler only forwarded `beta`, mapping every other value including `stable` to `undefined`. That made an explicit stable request indistinguishable from “no channel flag”, so env/config beta continued to win.

## Goals / Non-Goals

**Goals:**

- Make `--channel stable` and `--channel beta` both explicit, first-priority channel requests.
- Preserve current fallback behavior when the flag is omitted or invalid.
- Keep the fix narrow and regression-tested.

**Non-Goals:**

- Changing channel semantics, release publishing, or beta artifact naming.
- Adding new channels.
- Making invalid `--channel` values hard errors (can remain silent fallback unless a later change wants stricter validation).

## Decisions

- Parse the CLI option through a small shared helper used by `src/cli.ts`, so the mapping is unit-testable without booting the full Commander program.
- Accept only `stable` | `beta` as explicit requests; anything else stays `undefined` and uses existing env/config resolution.
- Update the self-upgrade requirement with an explicit-stable-overrides-beta scenario so this cannot regress back to “only beta is explicit”.

## Risks / Trade-offs

- Invalid values continue to fall back quietly. That matches current behavior and keeps this change a correctness fix rather than a UX/validation expansion.
