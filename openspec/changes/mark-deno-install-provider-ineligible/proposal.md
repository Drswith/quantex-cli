## Why

`narrow-catalog-install-providers` restricted catalog entries to `bun`, `npm`, `brew`, `winget`, `script`, and `binary`, and marked `cargo`, `mise`, `pip`, and `uv` ineligible. `deno` belongs to the same category — it is a language-runtime toolchain, not native binary distribution — but it was deliberately left eligible, because `genie` was still its only consumer and forbidding it would have left that entry with zero install methods on every platform.

`remove-niche-agent-catalog-entries` has since withdrawn `genie`. `deno` now has zero catalog consumers, so it can join the ineligible set without touching a single entry. This closes the rule that the narrowing change opened.

This changes agent catalog metadata rules, so it is classified as requiring an OpenSpec change before edits.

## What Changes

- Add `deno` to the set of install providers a catalog entry MUST NOT declare, and to the set of provider implementations retained for already-recorded installs.
- State explicitly that eligibility binds catalog entries only, so the frozen `genie` definition retained under `compatibility-contract` keeps its `deno` method and is not "corrected" later.
- No catalog entry changes. No entry declares `deno`, so the generated catalog, provider-support table, docs, and command output are all unchanged.

**Not changing** (deliberately):

- The `deno` provider implementation, `isDenoAvailable`, the `deno` member of `InstallType`, or the provider enum in `catalog.schema.json`. Removing those is published-surface work for a future major, and they must stay reachable for any installation already recorded as `deno`.
- The retained `genie` definition in `src/agents/withdrawn/`, which still declares `deno` because that is what the catalog last offered.

## Capabilities

### Modified Capabilities

- `agent-catalog`: extend the install-provider eligibility rule to cover `deno`, and scope the rule explicitly to catalog entries rather than to retained withdrawn definitions.

### New Capabilities

- None.

## Impact

- **Not breaking, and no runtime change.** This is a governance-only edit: it forbids a shape the catalog no longer contains. No command, flag, schema field, type, export, generated file, or persisted-state format changes.
- Affected specs: `openspec/specs/agent-catalog/spec.md`.
- Affected code: none. Verified: no file under `src/agents/catalog/` declares a `deno` provider, and `docs/generated/agent-provider-support.md` already reports `deno` at zero agents.
- `deno` provider tests are unaffected. `test/package-manager/deno.test.ts` and the `deno` paths in `test/providers/` drive the provider through synthetic identifiers rather than catalog lookups.
- **Depends on** the archive of `narrow-catalog-install-providers`, because the requirement being modified only reaches `openspec/specs/` through that archive.
