## 1. Catalog data

- [x] 1.1 Delete `src/agents/catalog/{jcode,deepcode,genie,vtcode,forgecode}.json`.
- [x] 1.2 Run `bun run agent-catalog:generate` and confirm `src/agents/generated/{catalog-data.ts,catalog-agents.ts,catalog-support.json}` and `src/core/generated/{agent-catalog.ts,mutation-recipe-catalog.ts}` regenerate without the removed entries.
- [x] 1.3 Confirm no catalog entry, alias, or display name still resolves the removed names, including the `forge` alias.

## 2. Root exports

- [x] 2.1 Remove the five re-exports of catalog agents from `src/agents/index.ts`.
- [x] 2.2 Add `src/agents/withdrawn/` holding the frozen `jcode`, `deepcode`, `genie`, and `vtcode` definitions, projected through the catalog's own `toAgentDefinition` and `catalogSourceSchema`.
- [x] 2.3 Export `toAgentDefinition` from `src/agents/catalog.ts` without re-exporting it from `src/agents/index.ts`, so it stays off the v1 root surface.
- [x] 2.4 Re-export the four withdrawn names from `src/agents/index.ts` and keep them listed in `src/compatibility/index.ts`.
- [x] 2.5 Document the retained module with `//` line comments only; a JSDoc block would be emitted into `dist/index.d.mts` and change the pinned bytes.
- [x] 2.6 Confirm `forgecode` was never part of `src/index` and is removed outright with no retained export.

## 3. Pinned v1 contracts

- [x] 3.1 Confirm `test/fixtures/compatibility/v1/root-exports.json` is unchanged and still lists all 117 names, including the four withdrawn agents.
- [x] 3.2 Run `bun run build` and update `test/fixtures/compatibility/v1/root-declaration.json` with the rebuilt byte count and sha256.
- [x] 3.3 Record the evidence that the pin moved without an API change: the four `declare const <name>: AgentDefinition` lines and the terminal `export { ... }` list are identical before and after; only their position differs.
- [x] 3.4 Run `bun run package:check` and confirm the generated downstream consumer still compiles against the full export set.

## 4. Tests

- [x] 4.1 Replace the `deepcode`, `jcode`, and `vtcode` catalog describe blocks in `test/agents.test.ts` with a `withdrawn agents` suite asserting the four stay importable, stay out of the catalog and both lookup paths, and are not identity-equal to any catalog entry.
- [x] 4.2 Remove the withdrawn lookup, structure, and root re-export assertions from `test/index.test.ts`.
- [x] 4.3 Confirm `deno` provider coverage survives `genie`'s removal without new fixtures. `test/package-manager/deno.test.ts` and the `deno` paths in `test/providers/{system-package,managed-installer-compat}.test.ts` already drive the provider through synthetic identifiers rather than catalog lookups, so they need no edit.
- [x] 4.4 Drop the `genie` deno assertion from `test/catalog-normalized-python-rust.test.ts`; no catalog entry declares `deno` after the removal. Cargo projection stays covered there through `codewhale`.
- [x] 4.5 Remove the `genie` and `vtcode` provider expectations from `test/agent-canary-matrix.test.ts`.
- [x] 4.6 Correct the hardcoded catalog size in `test/catalog-support-generation.test.ts` from 37 to 32.
- [x] 4.7 Regenerate the v1 command-family goldens with `UPDATE_V1_COMMAND_GOLDENS=1` and confirm the regeneration touches only `capabilities`, `list`, and the `ls` alias.
- [x] 4.8 Confirm `test/compatibility/v1-baseline.test.ts` passes against the updated fixtures.

## 5. Docs

- [x] 5.1 Remove the five rows from `docs/agent-support-matrix.md` and correct any stated agent count.
- [x] 5.2 Update `README.md` and `README.zh-CN.md`.
- [x] 5.3 Update `skills/quantex-cli/references/command-recipes.md`.

## 6. Validation and delivery

- [x] 6.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`.
- [x] 6.2 Run `bun run test`.
- [x] 6.3 Run `bun run openspec:validate` and `bun run memory:check`.
- [x] 6.4 Run `bun run build` and `bun run package:check`.
- [x] 6.5 Open the PR with a body validated by `bun run pr:body:check`, declaring `Release: minor`.
- [ ] 6.6 Merge. No release gate applies, because no export, command, schema field, or type is removed.
