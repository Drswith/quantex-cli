## Why

`quantex list` reports Pi as having no available update while npm publishes `0.84.3`, because Pi's upstream package was renamed and Quantex still resolves versions from the abandoned name.

`@mariozechner/pi-coding-agent` is frozen at `0.73.1`, and that version carries an npm deprecation notice naming `@earendil-works/pi-coding-agent` as its replacement. The replacement is at `0.84.3`. Quantex queries the superseded name, receives `0.73.1`, compares it against the installed `0.73.1`, and concludes the install is current. `quantex update pi --dry-run` reports `"status": "up-to-date"` for the same reason. Nothing errors; the answer is confidently wrong.

Correcting the catalog alone does not fix installs that already exist. `getLatestVersionPackage()` resolves `state.packageName || agent.packages?.npm`, so a recorded install pins package identity ahead of the catalog. Repointing `pi.json` at the replacement package and re-running `quantex inspect pi --no-cache` still returns `latestVersion: "0.73.1"` — verified locally before writing this proposal. Every existing Pi install therefore stays silently stale after a catalog-only fix, and no current guardrail catches it: the recorded binding is internally consistent with live provider evidence, so the `stale-state` and `unsafe-source` paths in update planning never fire.

A package rename is not a Pi-specific event. Kimi Code already moved distribution once, and that change recorded surviving legacy state as an accepted risk rather than something Quantex could observe. Declaring the superseded identity in the catalog turns that risk into an observable condition.

Work-intake classification: agent catalog metadata, update strategy, and observable CLI behavior. That requires an OpenSpec change before edits.

## What Changes

- Repoint Pi's catalog entry at `@earendil-works/pi-coding-agent` for the bun and npm candidates on all three platforms.
- Add optional `supersededPackages` metadata to catalog entries: identifiers an agent was previously distributed under, keyed by the same package-metadata provider keys as `packages`. Declare `@mariozechner/pi-coding-agent` under Pi's `npm` key.
- Reject a catalog entry that declares one identifier as both a current and a superseded package under the same provider key.
- Stop resolving a target version from a superseded package. A recorded install bound to a superseded identifier MUST report an unknown target version rather than a version comparison that reads as up-to-date.
- Surface the condition rather than hiding it behind an absent value:
  - `quantex update <agent>` returns `manual-required`, naming the rename and the reinstall commands, instead of `up-to-date`.
  - `quantex list` marks the agent `migrate` in the `Available` column and prints the warning below the table.
  - `quantex inspect <agent>` reports the recorded superseded package beside the current package.
  - All three attach an `AGENT_PACKAGE_SUPERSEDED` warning carrying the recorded package, the current package, and the suggested commands.

**Not changing** (deliberately):

- No automatic migration. `quantex update` does not gain the ability to uninstall one package and install another; reinstalling stays an explicit user action. Automatic migration was considered and declined for this change because it widens update from "upgrade one bound package" to "re-bind package identity", which needs its own verification contract.
- No change to Cursor CLI, or to target-version discovery for script-installed agents. Cursor's empty `Available` column is the specified outcome of an undeclared `target-version` probe, not a defect in this area.
- No general fix for `Available` rendering `—` for both "already current" and "cannot be determined". Only the superseded case gains a distinct marker.
- No new fields on the v1 agent objects in `list` or `inspect` structured output. The machine-readable signal rides the existing `warnings[]` array.
- No state-file rewrite and no state schema version bump. Recorded package identity is read as-is and interpreted against the catalog.

## Capabilities

**New Capabilities:** none.

**Modified Capabilities:**

- `agent-catalog` — superseded package declaration, its conflict rule, and Pi's package identity.
- `agent-update` — target-version resolution and update planning for a recorded install bound to a superseded package.
- `human-readable-output` — the inventory marker and warning for a superseded install.

## Impact

- Catalog data and schema: `src/agents/catalog/pi.json`, `src/agents/schema.ts`, `src/agents/types.ts`, `src/agents/catalog.ts`, the generated catalog manifest, and `src/agents/catalog.schema.json`.
- Version resolution: `src/utils/install.ts` (`getLatestVersionPackage`), `src/inspection/agents.ts`, `src/services/lifecycle-observations.ts`.
- Update planning and presentation: `src/services/lifecycle-updates.ts`, `src/commands/update.ts`, `src/commands/list.ts`, `src/commands/inspect.ts`.
- Structured output: one new warning code, `AGENT_PACKAGE_SUPERSEDED`. No existing field changes type or disappears; `latestVersion` becomes absent for a superseded install, which the field's optionality already permits.
- Users with an existing Pi install must run `quantex uninstall pi && quantex install pi` once to move onto the current package. Until they do, Quantex reports the migration instead of a version comparison.
