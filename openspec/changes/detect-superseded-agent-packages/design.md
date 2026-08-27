## Context

Pi's upstream package moved from `@mariozechner/pi-coding-agent` to `@earendil-works/pi-coding-agent`. The old identifier still resolves on the npm registry, still reports a `latest` dist-tag, and still matches the version installed on disk. Every input Quantex consults is internally consistent; only the identifier itself is obsolete. That is why the failure is silent rather than an error: `getLatestVersionPackage()` returns the recorded package, `getLatestVersion()` resolves `0.73.1` from it, and the comparison correctly concludes "no newer version".

Two constraints shape the design.

**Recorded package identity outranks the catalog.** `getLatestVersionPackage()` resolves `state.packageName || agent.packages?.npm`, and `confirmedBinding()` in update planning requires the receipt, the persisted binding, and the live observation to agree on `providerTargetId`. That precedence is deliberate — it stops Quantex from updating one package through another package's identity — so this change works with it rather than inverting it.

**The v1 root declaration is pinned by exact bytes and digest.** `AgentDefinition`, `AgentCatalogEntry`, and `agentCatalogEntrySchema` are all re-exported from the package root through `src/compatibility/index.ts`. `compatibility-contract` permits re-pinning only when declarations move and the change records evidence that declared types are unchanged. Adding a property to any of those types would change a declared type, which that requirement does not sanction.

## Goals / Non-Goals

**Goals:**

- Stop Quantex resolving a target version from a package identifier that no longer receives upstream releases.
- Make the resulting condition observable in `list`, `inspect`, and `update` instead of appearing as "already current".
- Express the supersession as catalog data, so the next rename is a data edit rather than another investigation.
- Leave the pinned v1 root declaration byte-identical.

**Non-Goals:**

- Automatic migration between package identifiers.
- Any change to Cursor CLI, to the `script` provider, or to target-version discovery for script installs.
- A general redesign of how `Available` distinguishes "already current" from "cannot determine".
- Rewriting or versioning the persisted state file.
- Enforcing the replacement package's Node engine requirement, or otherwise gating install on runtime version.

## Decisions

### 1. Declare superseded identifiers in the catalog source schema, not on the exported types

`supersededPackages` is added to `catalogSourceEntrySchema` only. `agentCatalogEntrySchema`, `AgentCatalogEntry`, `AgentDefinition`, and the generated `catalog.schema.json` are untouched, so `dist/index.d.mts` keeps its pinned bytes and digest.

This is not a workaround; it matches what the source schema already is. `catalog.schema.json` describes the projected entry shape and already omits `provider`, `target`, `probes`, and `effect` — every field the normalized candidate form introduced. Superseded identifiers belong to the same category: catalog authoring input that the v1 projection does not carry.

The alternative — extend the exported types and update the pin — was rejected. `compatibility-contract` allows a pin update when declarations reorder and the declared types are unchanged; an added property is a changed declared type, so taking that path would mean amending the compatibility requirement itself to permit additive properties. That is a governance change with a much wider blast radius than the bug being fixed, and it would weaken a gate that exists precisely to catch unreviewed surface drift.

Consequence: `toAgentDefinition()` currently spreads the whole source entry, so it MUST strip `supersededPackages` explicitly. Otherwise every `AgentDefinition` would carry a field its type does not declare, which is exactly the kind of untyped runtime payload the projection exists to prevent.

Lookup goes through a dedicated helper keyed by agent name, reading the already-parsed catalog source. Call sites that need it (`getLatestVersionPackage`, update planning, the three presenters) have the agent name available.

### 2. Key superseded identifiers by package-metadata provider key

```json
"supersededPackages": { "npm": ["@mariozechner/pi-coding-agent"] }
```

This reuses `getPackageMetadataKey()`, which already collapses `bun` and `npm` onto the `npm` key because both install the same registry artifact. Pi is installable through either provider, so a recorded install can carry `installType: "bun"` or `installType: "npm"` with the same package identifier, and one declaration covers both.

A flat `string[]` was rejected: it drops provider precision, so a Cargo crate and an npm package sharing a name would collide. A per-candidate `{provider, id, kind}` list was rejected for the opposite reason: it forces the same identifier to be written once per provider, which is duplication that can drift.

The conflict rule — one identifier MUST NOT be both current and superseded under a single key — is enforced at catalog parse time, next to the existing check that rejects conflicting package targets for one key. A contradictory declaration is an authoring mistake, and failing at load makes it impossible to ship.

### 3. Report the target version as unresolved, not as the current package's version

When a recorded install matches a superseded identifier, resolution returns nothing. It does not fall back to resolving `@earendil-works/pi-coding-agent`.

Reporting `0.84.3` as "available" would be a promise Quantex cannot keep: the install is bound to the other package, so the managed update path would run an update against `@mariozechner/pi-coding-agent` and succeed at doing nothing. An available-update claim that no update command can satisfy is a worse failure than the silent one being fixed, because it repeats on every invocation and looks like a broken updater.

The honest statement is "this installation cannot be compared", carried together with the reason and the remediation.

### 4. Carry the machine-readable signal on `warnings[]`

A new warning code, `AGENT_PACKAGE_SUPERSEDED`, with `details` naming the recorded package, the current package, and `suggestedCommands`. This follows `AGENT_STALE_STATE`, which already pairs a human sentence with a structured `suggestedAction` and command list.

No agent object in `list` or `inspect` structured output gains a field. `latestVersion` becomes absent for these installs, which its existing optionality already covers, and `machine-readable output remains unchanged` in `human-readable-output` stays satisfied for every other field.

### 5. `update` returns `manual-required`, not a new status

The `UpdateStatus` union already carries `manual-required`, and the blocked path already maps categories onto it with a `message`. A superseded binding is a manual-action outcome in exactly that sense, so it reuses the status rather than widening a stable enum in structured output.

## Risks / Trade-offs

- [A user ignores the warning and stays on the superseded package indefinitely] → Accepted, and it is the direct consequence of choosing not to auto-migrate. Quantex reports the condition on every `list`, `inspect`, and `update`; it does not act on the user's behalf.
- [`migrate` in a version column reads as a version to a scanning eye] → The token is styled distinctly from a version and the table is followed by a warning line naming the packages and the exact commands. The alternative, leaving the cell empty, is the ambiguity that hid this bug for months.
- [Upstream renames again and the declaration goes stale] → The conflict rule catches the contradictory half of that mistake at parse time. The remaining half, forgetting to declare a new supersession, is the same maintenance burden the catalog already carries for every other upstream fact.
- [`latestVersion` disappearing surprises a structured consumer that assumed it was always present] → The field is already absent today for every script-installed agent, including Cursor and Grok, so consumers that treat absence as "unknown" are already correct. The warning gives them a positive signal for the new case.
- [Declaring supersession in the source schema only means a downstream consumer of `AgentCatalogEntry` cannot see it] → Intended. That surface is frozen v1 data, and superseded identity is lifecycle-resolution input, not part of the published entry shape.

## Migration Plan

Catalog data and resolution logic ship together in one change; neither is useful alone. A user with an existing Pi install runs `quantex uninstall pi && quantex install pi` once, after which the recorded package identity matches the catalog and the superseded path stops firing for them.

Rollback is reverting the change: resolution returns to reading the recorded identifier unconditionally, which restores the silent-but-harmless prior behavior.

## Open Questions

None blocking. Whether `update` should eventually perform the migration itself is deferred, and would need its own change: re-binding package identity requires a verification contract that the current update postconditions, which assume one package throughout, do not express.
