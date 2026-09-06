## Context

Cursor CLI installs as both `agent` and `cursor-agent`. Quantex catalogs it as `name: cursor`, `binaryName: agent`, `lookupAliases: ["agent"]`, `versionProbe.command: ["agent", "--version"]`. Observation resolves the executable with `which`/`where` on `binaryName` and, when the probe command leads with that same name, substitutes the resolved absolute path.

That substitution already matches `lifecycle-reconciliation`: probes go through the resolved path, not a second bare-name spawn. The remaining bug is the resolution itself. The first `agent` on `PATH` may be some other tool (issue #715). Closed PR #714 changed `binaryName` to `cursor-agent` and added lookup alias `cursor`, which failed:

- `test/agents.test.ts` locks `binaryName` to `agent`
- lookup aliases MUST NOT repeat the canonical name `cursor`
- v1 list/inspect goldens include `binaryName: "agent"`

A later attempt added `versionProbe.preferredBinaries` to the public `AgentVersionProbe` type and catalog schema. That expanded the v1 root declaration type set (`dist/index.d.mts` pin) and is rejected: pin updates are allowed only for reordering/size/hash drift that does not change the exported type set or symbol set.

## Goals / Non-Goals

**Goals:**

- `list` / `inspect` installed-version for Cursor matches the Cursor executable Quantex resolved.
- Prefer a unique Cursor executable name (`cursor-agent`) when locating that binary, then probe via the resolved absolute path.
- Keep catalog identity, CLI contracts, and the v1 root declaration type/export set frozen.

**Non-Goals:**

- Renaming the agent, changing `binaryName`, or adding `cursor` as a lookup alias.
- Adding catalog fields or public type members such as `preferredBinaries`.
- Widening `--json` / exit codes / inspect-list field sets.
- Heuristic fingerprinting of arbitrary `agent` binaries.
- Self-upgrade, release-core.yml, protect-main, YAML, P9, config fold, command/SDK expansion.
- Changing `selfUpdate.command` (`agent update`).

## Decisions

1. **Probe targeting is an internal table, not a catalog or v1 type field.** Key extra lookup names by canonical agent name (`cursor` → `cursor-agent`). `binaryName` stays `agent`. Lookup aliases stay `["agent"]`. `AgentVersionProbe`, catalog JSON, catalog schema, and Core catalog projection stay unchanged. CLI `--json` does not grow a new field.

2. **Resolve preferred names completely before falling back.** For Cursor, try `cursor-agent` then `agent` (deduped, first wins): look up `PATH`, then known install directories. Stop at the first hit. That way a `cursor-agent` in `~/.local/bin` wins over an unrelated `agent` earlier on `PATH`. Other agents keep a single-name lookup of `binaryName`.

3. **Keep the existing substitution rule.** Probe command remains `["agent", "--version"]`, so `command[0] === binaryName` still substitutes the resolved absolute path (which may be `.../cursor-agent`). Custom probes whose first argument is not the executable name stay unchanged.

4. **One targeting helper, used by Core observation and the shared resolver.** Core list/inspect goes through `production-observation`. The same lookup-name order is applied in `resolveAgentExecutablePath` so update observation and leftover inspection paths do not drift. Do not edit KEEP-marked leftover comments or self-upgrade modules. Keep the helper in `src/utils/executable-search-paths.ts` so Core's allowed runtime closure does not grow.

5. **Fallback remains `agent`.** If `cursor-agent` is absent, behavior stays PATH-then-known-dir lookup of `agent`. That preserves single-name installs; it cannot disambiguate two unrelated `agent` binaries without identity churn.

6. **v1 root-declaration pin.** Refresh `test/fixtures/compatibility/v1/root-declaration.json` only if the built `dist/index.d.mts` bytes/hash drift from reordering or size with an unchanged exported type set and symbol set. Do not expand root exports under the guise of fixing the probe.

## Risks / Trade-offs

- **Preferred name in known dirs beats PATH `agent`.** Intentional: the unique Cursor name is stronger evidence than a generic PATH hit.
- **Fallback still collides** when only a non-Cursor `agent` exists. Accepted; fixing that would require fingerprinting or renaming `binaryName`.
- **Cursor targeting is a named special case.** Accepted over a public catalog field: the v1 type/export freeze outranks making this data-driven in catalog JSON.
