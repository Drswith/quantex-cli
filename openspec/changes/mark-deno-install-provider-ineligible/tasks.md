## 1. Spec

- [x] 1.1 Add `deno` to the ineligible provider list and to the retained-provider list in the `Catalog install methods MUST come from the eligible provider set` requirement.
- [x] 1.2 Scope the requirement explicitly to catalog entries, so a withdrawn agent's retained definition may keep an ineligible method.
- [x] 1.3 Add a scenario covering a withdrawn agent's frozen definition, so the retained `genie` `deno` method is not later "corrected".

## 2. Verification

- [x] 2.1 Confirm no file under `src/agents/catalog/` declares a `deno` provider.
- [x] 2.2 Confirm `docs/generated/agent-provider-support.md` already reports `deno` at zero agents, so no regeneration is needed.
- [x] 2.3 Confirm `deno` provider coverage does not depend on catalog membership: `test/package-manager/deno.test.ts` and the `deno` paths in `test/providers/` use synthetic identifiers.
- [x] 2.4 Confirm the `deno` member of `InstallType` and the provider enum in `catalog.schema.json` are untouched, so already-recorded `deno` installs keep their managed lifecycle.

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`.
- [x] 3.2 Skip `bun run test`: this change touches only `openspec/`, adds no source or fixture edit, and forbids a catalog shape that does not exist, so no test outcome can differ.
- [x] 3.3 Run `bun run openspec:validate` and `bun run memory:check`.
- [x] 3.4 Open the PR with a body validated by `bun run pr:body:check`, declaring no release entry.
- [ ] 3.5 Merge after the archive PR lands, because this change modifies a requirement that only reaches `openspec/specs/` through that archive.
