## Context

Cursor CLI installs as both `agent` and `cursor-agent`. Quantex catalogs it as `name: cursor`, `binaryName: agent`, `lookupAliases: ["agent"]`, `versionProbe.command: ["agent", "--version"]`. Observation resolves the executable with `which`/`where` on `binaryName` and, when the probe command leads with that same name, substitutes the resolved absolute path.

That substitution already matches `lifecycle-reconciliation`: probes go through the resolved path, not a second bare-name spawn. The remaining bug is the resolution itself. The first `agent` on `PATH` may be some other tool (issue #715). Closed PR #714 changed `binaryName` to `cursor-agent` and added lookup alias `cursor`, which failed:

- `test/agents.test.ts` locks `binaryName` to `agent`
- lookup aliases MUST NOT repeat the canonical name `cursor`
- v1 list/inspect goldens include `binaryName: "agent"`

## Goals / Non-Goals

**Goals:**

- `list` / `inspect` installed-version for Cursor matches the Cursor executable Quantex resolved.
- Prefer a unique Cursor executable name (`cursor-agent`) when locating that binary, then probe via the resolved absolute path.
- Keep catalog identity and CLI contracts frozen.

**Non-Goals:**

- Renaming the agent, changing `binaryName`, or adding `cursor` as a lookup alias.
- Widening `--json` / exit codes / inspect-list field sets.
- Heuristic fingerprinting of arbitrary `agent` binaries.
- Self-upgrade, release-core.yml, protect-main, command/SDK expansion.
- Changing `selfUpdate.command` (`agent update`).

## Decisions

1. **Preferred binaries are probe-targeting metadata, not identity.** Add optional `versionProbe.preferredBinaries: string[]`. Cursor sets `["cursor-agent"]`. `binaryName` stays `agent`. Lookup aliases stay `["agent"]`. CLI `--json` does not grow a new field.

2. **Resolve preferred names completely before falling back.** For each name in `[...preferredBinaries, binaryName]` (deduped, first wins): look up `PATH`, then known install directories. Stop at the first hit. That way a `cursor-agent` in `~/.local/bin` wins over an unrelated `agent` earlier on `PATH`.

3. **Keep the existing substitution rule.** Probe command remains `["agent", "--version"]`, so `command[0] === binaryName` still substitutes the resolved absolute path (which may be `.../cursor-agent`). Custom probes whose first argument is not the executable name stay unchanged.

4. **One targeting helper, used by Core observation and the shared resolver.** Core list/inspect goes through `production-observation`. The same lookup-name order is applied in `resolveAgentExecutablePath` so update observation and leftover inspection paths do not drift. Do not edit KEEP-marked leftover comments or self-upgrade modules.

5. **Fallback remains `agent`.** If `cursor-agent` is absent, behavior stays PATH-then-known-dir lookup of `agent`. That preserves single-name installs; it cannot disambiguate two unrelated `agent` binaries without identity churn.

## Risks / Trade-offs

- **Preferred name in known dirs beats PATH `agent`.** Intentional: the unique Cursor name is stronger evidence than a generic PATH hit.
- **Fallback still collides** when only a non-Cursor `agent` exists. Accepted; fixing that would require fingerprinting or renaming `binaryName`.
- **Generated catalogs must copy `preferredBinaries`.** Core observation reads the generated Core catalog; omitting the field would leave list/inspect on `agent` only.
