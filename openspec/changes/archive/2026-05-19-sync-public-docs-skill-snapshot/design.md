## Context

The CLI behavior and catalog are already current. `bun run src/cli.ts capabilities --json` reports 28 supported agents, including `reasonix` and `vtcode`, and the English and Chinese supported-agent README tables already include both entries.

The remaining drift is limited to mirrors that users and agents may read directly:

- `skills/quantex-cli/references/command-recipes.md` maintains a supported-agent snapshot for prompt-time use.
- `README.zh-CN.md` mirrors the English README but currently omits the newer isolation smoke commands from the maintainer command list.

## Goals / Non-Goals

**Goals:**

- Make the public skill snapshot match the current supported-agent catalog.
- Make the Simplified Chinese README match the English README for maintainer validation commands.
- Validate the updated skill and OpenSpec state.

**Non-Goals:**

- Change CLI behavior, schemas, command catalog, or agent metadata.
- Add new supported agents.
- Rework skill distribution, runtime boundaries, or archive existing completed OpenSpec changes.

## Decisions

- Keep the skill snapshot as a short mirror rather than replacing it with generated output. The file already tells consumers the running binary remains the source of truth, so the useful fix is to remove known stale omissions while preserving that caveat.
- Add `reasonix` and `vtcode` in the same order returned by `capabilities --json`.
- Copy the English README's `test:container` / `test:sandbox` guidance into Simplified Chinese with equivalent meaning, not a new policy.

## Risks / Trade-offs

- [Mirror drift] Manually maintained snapshots can drift again. Mitigation: keep `skills/quantex-cli/scripts/smoke-check.sh` in the validation path and rely on `capabilities --json` as the source of truth during audits.
- [Scope creep] Public docs work could expand into behavior changes. Mitigation: this change only edits documentation/OpenSpec artifacts and does not touch `src/`.

## Validation Plan

- Run `skills/quantex-cli/scripts/smoke-check.sh`.
- Run `bun run openspec:validate`.
- Run the repository doc-change baseline: `bun run lint`, `bun run format:check`, and `bun run typecheck`.
