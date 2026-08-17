## Context

Four providers serve very few entries: `cargo` (2), `uv` (2), `pip` (1), `mise` (1). Each is a full toolchain Quantex must detect, probe, version-compare, update, and uninstall through. Narrowing the catalog to the Node ecosystem plus native binary distribution removes that carrying cost without removing any agent.

## Goals / Non-Goals

**Goals**

- Stop the catalog from routing installation through Rust, Python, and polyglot-version-manager toolchains.
- Keep every agent in the catalog, and keep every platform that still has a real install route.
- Keep already-installed users whole.

**Non-Goals**

- Removing the provider implementations, the `InstallType` union members, or the schema enum values. Those are published surfaces; see below.
- Touching `deno`. See the sequencing note.
- Removing any agent.

## Decisions

### Provider ineligibility is a catalog rule, not a provider deletion

The tempting version of this change deletes the `cargo`, `mise`, `pip`, and `uv` providers outright. That would break two things.

First, it is a published-surface break. `InstallType` is exported from the package root and the same names are enum values in `src/agents/catalog.schema.json`. Removing union members and enum values changes a consumer-visible type and schema, which is a major-release concern — and the repository's stable v2 gate is deny-by-default, so that version of this change could not merge for an indeterminate period. Keeping the providers keeps this change a normal minor.

Second, and more concretely, it would strand existing users. `getManagedInstallerTypeFromContext` in `src/agent-update/providers.ts` reads `context.installedState.installType` **before** it falls back to `context.methods`, and `src/package-manager/capabilities.ts` derives capability from `firstPartyProviderRegistry` rather than from catalog membership. So a user who installed `codewhale` through `cargo` keeps a working managed update and uninstall path after `cargo` leaves the entry — but only because the provider still exists. Deleting it would convert those users' installs into unmanageable ones.

The rule is therefore expressed as catalog eligibility, and the retained-provider guarantee is written into the spec so a later cleanup does not quietly drop it.

### `vibe` loses Windows rather than keeping an unusable entry

`vibe` declares `uv` and `pip` on Windows and nothing else; macOS and Linux additionally carry the official shell installer. Removing the ineligible providers leaves Windows with zero methods.

Keeping a Windows platform Quantex cannot install on would be worse than not claiming it: `quantex install vibe` on Windows would enumerate no methods and fail at the point of use rather than at the point of discovery. The entry drops `platforms.windows` and becomes a macOS and Linux agent, which is an existing shape in the catalog — `auggie` and `openhands` are already two-platform entries.

This is the one place where the narrowing costs real capability rather than tidiness. Upstream publishes no non-Python Windows installer for Mistral Vibe, so the alternative is an exception that keeps `pip`/`uv` alive solely for one entry on one platform, which defeats the rule. The `uv` REMOVED entry records the direct `uv tool install mistral-vibe` route for Windows users.

### `deno` is deliberately untouched

`deno` belongs to the same category as the four being removed, but its only consumer is `genie`, and forbidding it here would leave `genie` with zero install methods on every platform — which under this change's own rule means dropping the entry, and dropping `genie` removes a v1 root export. That is a breaking change gated behind the deferred stable v2 readiness gate, and folding it in would drag this otherwise-minor change behind that gate too.

`genie`'s withdrawal is already proposed separately in `remove-niche-agent-catalog-entries` (PR #660). Once that lands, `deno` has no catalog consumer and can be added to the ineligible set by a follow-up that touches no entry at all. Sequencing it that way keeps each change independently mergeable.

## Risks / Trade-offs

- **Windows users of `vibe` lose the Quantex install path.** Mitigated by recording the direct upstream command in the spec migration note. Not mitigated otherwise; this is an accepted cost.
- **Fresh installs change route** for five entries. `codewhale` moves from a `cargo`-or-`npm` choice to `npm` only; `codex` loses `mise`; `openhands` and `vibe` fall back to their official scripts; `vtcode` falls back to script or Homebrew. All were already-declared methods, so none is a new or unverified route.
- **The retained providers now have few or no catalog consumers.** This mirrors the existing state of `binary`, which has none. Provider tests are driven by synthetic identifiers rather than catalog lookups, so coverage does not depend on an entry existing.
- **Merge interaction with PR #660.** This change edits `src/agents/catalog/vtcode.json`; #660 deletes it. Whichever lands second resolves the delete-versus-modify conflict by taking the deletion. The `agent-catalog` spec deltas live in separate change directories and do not conflict, but both touch `docs/agent-support-matrix.md` and `docs/generated/agent-provider-support.md`, which resolve by regenerating.
