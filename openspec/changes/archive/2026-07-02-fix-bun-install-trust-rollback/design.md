## Context

`runGlobalBunCommandWithTrust()` runs `bun add -g` or `bun update -g`, then probes `bun pm -g untrusted` and may run `bun pm -g trust`. When trust verification fails, the function returns `false` even though the primary command already mutated global packages. `installAgent()` treats that as a failed attempt and continues to the next install method.

## Goals / Non-Goals

**Goals**

- Remove packages added by a successful `bun add -g` when trust verification fails afterward.
- Preserve existing fail-closed semantics for trust probe failures.
- Allow safe fallback to the next install method without leaving a duplicate Bun global install.

**Non-Goals**

- Roll back successful `bun update -g` mutations on trust failure.
- Change npm/bun fallback ordering or installer selection.

## Decisions

- Detect install vs update from the Bun subcommand in the command array (`add` vs `update`).
- On trust failure after `add`, best-effort `bun remove -g` for each requested package name before returning `false`.
- Keep rollback inside `bun.ts` so all Bun install entry points share the behavior.

## Risks / Trade-offs

- [Risk] Rollback remove fails and leaves the package installed. → Mitigation: best-effort remove; fallback install methods still work, but duplicate risk is reduced when remove succeeds.
- [Risk] Partial batch add in `updateMany` is not in scope; Bun install paths use single-package commands today.
