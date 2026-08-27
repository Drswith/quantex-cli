## 1. Catalog metadata

- [x] 1.1 Add `supersededPackages` to `catalogSourceEntrySchema` in `src/agents/schema.ts`, keyed by the same provider keys as `agentPackageMetadataSchema`, each key holding a non-empty array of non-empty identifiers, with at least one key present
- [x] 1.2 Leave `agentCatalogEntrySchema`, `agentCatalogSchema`, and `agentCatalogJsonSchema` unchanged so the generated `catalog.schema.json` and the pinned root declaration stay byte-identical
- [x] 1.3 Reject a catalog entry that declares one identifier as both a current and a superseded package under the same provider key, next to the existing conflicting-target check in `projectLegacyPackages`
- [x] 1.4 Strip `supersededPackages` in `toAgentDefinition` so projected `AgentDefinition` objects carry no field their type does not declare
- [x] 1.5 Add a superseded-package lookup module exposing resolution by agent name and a predicate that matches a recorded `installType` plus `packageName`
- [x] 1.6 Repoint `src/agents/catalog/pi.json` at `@earendil-works/pi-coding-agent` for the bun and npm candidates on all three platforms, and declare `@mariozechner/pi-coding-agent` under `supersededPackages.npm`
- [x] 1.7 Run `bun run agent-catalog:generate` and confirm `catalog.schema.json` is unchanged

## 2. Version resolution

- [x] 2.1 Return no package from `getLatestVersionPackage` when the recorded install matches a superseded identifier, without falling back to the current identifier
- [x] 2.2 Keep the condition distinguishable for callers: `src/inspection/agents.ts` and `src/services/lifecycle-observations.ts` need no change because both retain `installedState`, so each presenter resolves the migration itself rather than reading a second resolution flag
- [x] 2.3 Confirm an install already bound to the current identifier is unaffected by the declaration

## 3. Update planning and presentation

- [x] 3.1 Block update planning for a superseded binding before the up-to-date comparison, returning a manual outcome that names the current identifier
- [x] 3.2 Add the `AGENT_PACKAGE_SUPERSEDED` warning carrying the recorded package, the current package, `suggestedAction`, and the uninstall and install commands
- [x] 3.3 Emit the warning and `manual-required` status from `quantex update`
- [x] 3.4 Mark the `Available` column `migrate` in `quantex list` human output and print the warning below the table
- [x] 3.5 Report the recorded superseded package beside the current package in `quantex inspect` human output, and attach the warning
- [x] 3.6 Confirm no agent object in `list` or `inspect` structured output gains or loses a field beyond `latestVersion` becoming absent

## 4. Tests

- [x] 4.1 Catalog schema tests: a valid superseded declaration parses, a contradictory declaration is rejected, and an entry without the field still parses
- [x] 4.2 Catalog projection test: `AgentDefinition` objects do not carry `supersededPackages`
- [x] 4.3 Pi catalog test: bun and npm candidates bind `@earendil-works/pi-coding-agent` on all three platforms and the superseded identifier is declared
- [x] 4.4 Resolution tests: a recorded install on a superseded identifier resolves no target version and issues no registry lookup for it; an install on the current identifier resolves normally
- [x] 4.5 Update planning test: a superseded binding yields `manual-required` with the warning, not `up-to-date`
- [x] 4.6 Presentation tests: `list` renders `migrate` and the warning; `inspect` reports both packages
- [x] 4.7 Structured-output test: the v1 payload shape is otherwise unchanged

## 5. Validation and closure

- [x] 5.1 `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 5.2 `bun run test`
- [x] 5.3 `bun run openspec:validate`
- [x] 5.4 Verify against the real registry that a Pi install recorded on the superseded identifier now reports migration, and that a fresh install resolves `@earendil-works/pi-coding-agent`
- [ ] 5.5 Commit, push, and open the PR with a validated body file
