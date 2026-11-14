## Context

Amp's catalog candidates currently target `@sourcegraph/amp`. That package is now a compatibility alias whose `bin.amp` is `node_modules/@ampcode/cli/bin/amp.exe`. npm can still materialize the nested dependency; Bun's flat global layout cannot. After `bun add -g @sourcegraph/amp`, registry-package verify is satisfied from package presence, and post-mutation observation merges `executable.present=true` even when PATH has no `amp`. `info`/`inspect` project `inPath` from PATH, so install reports success while the agent is not runnable.

`@ampcode/cli` publishes `bin.amp` as `bin/amp.exe` on the package itself. Catalog already has `supersededPackages` (used by Pi). Update planning already blocks recorded installs on a superseded identifier as `manual-required`.

## Goals / Non-Goals

**Goals:**

- New Amp installs through bun/npm bind `@ampcode/cli` so the executable is created.
- Recorded `@sourcegraph/amp` installs are treated as superseded, not silently updated in place.
- The agent-catalog spec names the current package.

**Non-Goals:**

- Changing `matchesLiveRecipe` / `mergeExecutableObservation` so package presence without PATH fails closed for every agent.
- Porting rust rewrite catalog, npm 12 `--allow-scripts`, or installer process-group fixes onto TypeScript main.
- Auto-migrating existing `@sourcegraph/amp` installs.
- Adding `detached: true` or touching the Windows self-upgrade helper.

## Decisions

- **Catalog identity, not engine verify.** The false success is triggered by the wrong package on Bun. Switching the catalog target is the same shape as the Pi package migration and is enough to make default `install amp` produce a runnable binary. Tightening PATH-required verify would change every registry-package install and is out of scope.
- **Reuse `supersededPackages`.** Recorded `@sourcegraph/amp` installs keep their source. Update already refuses to treat a superseded identifier as up-to-date or as the next update target. Users reinstall onto `@ampcode/cli`.
- **Do not add rust-only catalog fields.** TypeScript already has `supersededPackages`; no schema change.

## Risks / Trade-offs

- [Existing Bun Amp records stay non-runnable until reinstall] → inspect/list already surface migrate for superseded packages; recovery is `quantex uninstall amp` then `quantex install amp`, or install `@ampcode/cli` directly.
- [npm installs of `@sourcegraph/amp` may still have created `amp`] → superseded handling still asks for reinstall onto the current package rather than keeping the alias as the recorded source.
- [Windows helper parse HIGH remains on main] → already tracked in draft PR #763; this change does not touch it.
